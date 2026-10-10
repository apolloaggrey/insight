/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { createLocalJWKSet, decodeJwt, errors as joseErrors, type JSONWebKeySet, jwtVerify } from 'jose';

import { env } from '../env';
import { getIdToken } from '../queries/account.queries';

export type IdTokenClaims = Record<string, unknown>;
export type VerifiedClaimsResult =
	| { status: 'verified'; claims: IdTokenClaims }
	| { status: 'invalid' }
	| { status: 'unavailable' }
	| { status: 'no-token' };
export type DecodedClaimsResult =
	| { status: 'decoded'; claims: IdTokenClaims }
	| { status: 'invalid' }
	| { status: 'no-token' };

const METADATA_TTL_MS = 5 * 60_000;
const DEFAULT_OIDC_PROVIDER_ID = 'oidc';

interface ProviderMetadata {
	issuer: string;
	jwksUri: string;
	userinfoEndpoint: string | null;
}

class ProviderUnavailableError extends Error {}

const metadataCache = new Map<string, { value: ProviderMetadata; expiresAt: number }>();
const jwksCache = new Map<string, { value: JSONWebKeySet; expiresAt: number }>();

export async function readVerifiedOidcIdTokenClaims(userId: string): Promise<VerifiedClaimsResult> {
	const providerId = env.OIDC_PROVIDER_ID || DEFAULT_OIDC_PROVIDER_ID;
	const token = await getIdToken(userId, providerId);
	if (!token) {
		return { status: 'no-token' };
	}
	return verifyOidcIdTokenClaims(token);
}

export async function verifyOidcIdTokenClaims(token: string): Promise<VerifiedClaimsResult> {
	if (!env.OIDC_DISCOVERY_URL || !env.OIDC_CLIENT_ID) {
		return { status: 'unavailable' };
	}
	return verifyWithDiscovery(token, env.OIDC_DISCOVERY_URL, env.OIDC_CLIENT_ID, null);
}

/** The provider's userinfo endpoint, for profile fields an ID token leaves out. */
export async function fetchOidcUserInfo(accessToken: string): Promise<Record<string, unknown>> {
	if (!env.OIDC_DISCOVERY_URL) {
		return {};
	}
	const { userinfoEndpoint } = await getProviderMetadata(env.OIDC_DISCOVERY_URL);
	if (!userinfoEndpoint) {
		return {};
	}
	const response = await fetch(userinfoEndpoint, { headers: { authorization: `Bearer ${accessToken}` } });
	return response.ok ? ((await response.json()) as Record<string, unknown>) : {};
}

export async function verifyMicrosoftIdTokenClaims(token: string): Promise<VerifiedClaimsResult> {
	if (!env.AZURE_AD_TENANT_ID || !env.AZURE_AD_CLIENT_ID) {
		return { status: 'unavailable' };
	}
	const issuer = `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/v2.0`;
	return verifyWithDiscovery(token, `${issuer}/.well-known/openid-configuration`, env.AZURE_AD_CLIENT_ID, issuer);
}

/** Decode only, with no signature check: for showing an admin what a token contains, never for access. */
export function decodeIdTokenClaims(token: string): DecodedClaimsResult {
	try {
		return { status: 'decoded', claims: decodeJwt(token) as IdTokenClaims };
	} catch {
		return { status: 'invalid' };
	}
}

export async function readDecodedIdTokenClaims(userId: string, providerId: string): Promise<DecodedClaimsResult> {
	const token = await getIdToken(userId, providerId);
	return token ? decodeIdTokenClaims(token) : { status: 'no-token' };
}

async function verifyWithDiscovery(
	token: string,
	discoveryUrl: string,
	audience: string,
	expectedIssuer: string | null,
): Promise<VerifiedClaimsResult> {
	if (decodeIdTokenClaims(token).status !== 'decoded') {
		return { status: 'invalid' };
	}
	try {
		const metadata = await getProviderMetadata(discoveryUrl);
		if (expectedIssuer && metadata.issuer !== expectedIssuer) {
			return { status: 'invalid' };
		}
		return { status: 'verified', claims: await verifyToken(token, metadata, audience) };
	} catch (error) {
		return error instanceof ProviderUnavailableError ? { status: 'unavailable' } : { status: 'invalid' };
	}
}

async function verifyToken(token: string, metadata: ProviderMetadata, audience: string): Promise<IdTokenClaims> {
	const options = { issuer: metadata.issuer, audience, requiredClaims: ['exp', 'iat'] };
	try {
		const { payload } = await jwtVerify(token, createLocalJWKSet(await getJwks(metadata.jwksUri)), options);
		return payload as IdTokenClaims;
	} catch (error) {
		if (!(error instanceof joseErrors.JWKSNoMatchingKey)) {
			throw error;
		}
		const fresh = await getJwks(metadata.jwksUri, true);
		const { payload } = await jwtVerify(token, createLocalJWKSet(fresh), options);
		return payload as IdTokenClaims;
	}
}

async function getProviderMetadata(discoveryUrl: string): Promise<ProviderMetadata> {
	const cached = metadataCache.get(discoveryUrl);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}
	const document = await fetchJson(discoveryUrl);
	if (typeof document.issuer !== 'string' || typeof document.jwks_uri !== 'string') {
		throw new ProviderUnavailableError('Discovery document is missing issuer or jwks_uri');
	}
	const value = {
		issuer: document.issuer,
		jwksUri: document.jwks_uri,
		userinfoEndpoint: typeof document.userinfo_endpoint === 'string' ? document.userinfo_endpoint : null,
	};
	metadataCache.set(discoveryUrl, { value, expiresAt: Date.now() + METADATA_TTL_MS });
	return value;
}

async function getJwks(jwksUri: string, forceRefresh = false): Promise<JSONWebKeySet> {
	const cached = jwksCache.get(jwksUri);
	if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}
	const document = await fetchJson(jwksUri);
	if (!Array.isArray(document.keys)) {
		throw new ProviderUnavailableError('JWKS document has no keys');
	}
	const value = document as unknown as JSONWebKeySet;
	jwksCache.set(jwksUri, { value, expiresAt: Date.now() + METADATA_TTL_MS });
	return value;
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
	let response: Response;
	try {
		response = await fetch(url, { headers: { accept: 'application/json' } });
	} catch (error) {
		throw new ProviderUnavailableError(error instanceof Error ? error.message : String(error));
	}
	if (!response.ok) {
		throw new ProviderUnavailableError(`${url} answered ${response.status}`);
	}
	try {
		return (await response.json()) as Record<string, unknown>;
	} catch {
		throw new ProviderUnavailableError(`${url} did not return JSON`);
	}
}
