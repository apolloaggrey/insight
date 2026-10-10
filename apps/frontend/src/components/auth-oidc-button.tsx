/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { KeyRound } from 'lucide-react';

import Auth0Icon from '@/components/icons/auth0-icon.svg';
import KeycloakIcon from '@/components/icons/keycloak-icon.svg';
import OktaIcon from '@/components/icons/okta-icon.svg';
import { AuthSocialButton } from '@/components/ui/button';
import { handleOidcSignIn } from '@/lib/auth-client';
import { rememberSignInMethod } from '@/lib/last-sign-in-method';

type SvgIcon = React.FC<React.SVGProps<SVGSVGElement>>;

const PROVIDER_ICONS: Record<string, SvgIcon> = {
	okta: OktaIcon,
	auth0: Auth0Icon,
	keycloak: KeycloakIcon,
};

interface OidcSignInButtonProps {
	providerId: string;
	providerName: string;
	callbackUrl?: string;
	lastUsed?: boolean;
}

export function OidcSignInButton({ providerId, providerName, callbackUrl, lastUsed }: OidcSignInButtonProps) {
	return (
		<AuthSocialButton
			icon={PROVIDER_ICONS[providerId.toLowerCase()] ?? (KeyRound as SvgIcon)}
			label={`Continue with ${providerName}`}
			onClick={() => {
				rememberSignInMethod('oidc');
				handleOidcSignIn(providerId, callbackUrl);
			}}
			lastUsed={lastUsed}
		/>
	);
}
