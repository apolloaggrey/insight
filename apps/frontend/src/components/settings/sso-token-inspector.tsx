/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { SettingsCard } from '@/components/ui/settings-card';
import { useSession } from '@/lib/auth-client';
import { trpc } from '@/main';

const PROBLEM_HELP: Record<string, string> = {
	'no-token': 'This person has not signed in with company SSO yet, so there is no token to inspect.',
	'invalid-token': 'The stored ID token could not be read. Ask them to sign out and sign in again.',
	'claim-missing':
		'The token has no groups claim. Add a groups claim in your identity provider, or set OIDC_GROUPS_CLAIM to the claim it uses.',
	'claim-malformed': 'The groups claim is not a list of group names. Check its format in your identity provider.',
	'no-mapping':
		'No organization role mapping is set. Add OIDC_GROUP_INSIGHT_ROLE_MAPPING, e.g. admins:admin,analysts:user.',
	'no-group-matched':
		'None of these groups is in OIDC_GROUP_INSIGHT_ROLE_MAPPING, so no organization role was assigned. Add one of them to the mapping.',
};

export function SsoTokenInspector() {
	const session = useSession();
	const oidcConfig = useQuery(trpc.authConfig.oidc.getConfig.queryOptions());
	const members = useQuery(trpc.project.listAllUsersWithRoles.queryOptions());
	const [userId, setUserId] = useState<string | undefined>(undefined);
	const targetUserId = userId ?? session.data?.user.id;
	const inspection = useQuery({
		...trpc.authConfig.oidc.inspectToken.queryOptions({ userId: targetUserId }),
		enabled: !!oidcConfig.data && !!targetUserId,
	});

	if (!oidcConfig.data) {
		return null;
	}
	const result = inspection.data;

	return (
		<SettingsCard
			title='SSO token inspector'
			description={`See what ${oidcConfig.data.providerName} sends for a person and which organization role it maps to.`}
		>
			<div className='flex flex-col gap-4 text-sm'>
				<label className='flex items-center gap-2'>
					<span className='text-muted-foreground'>Person</span>
					<select
						className='rounded-md border bg-background px-2 py-1'
						value={targetUserId ?? ''}
						onChange={(event) => setUserId(event.target.value)}
					>
						{(members.data ?? []).map((member) => (
							<option key={member.id} value={member.id}>
								{member.email}
							</option>
						))}
					</select>
				</label>
				{inspection.isLoading && <p className='text-muted-foreground'>Reading the token…</p>}
				{inspection.isError && <p className='text-destructive'>{inspection.error.message}</p>}
				{result && <InspectionResult result={result} />}
			</div>
		</SettingsCard>
	);
}

interface Inspection {
	claimName: string;
	groups: string[];
	matchedGroups: string[];
	resolvedOrganizationRole: string | null;
	problem: string | null;
	claims: Record<string, unknown> | null;
	issuedAt: string | null;
}

function InspectionResult({ result }: { result: Inspection }) {
	return (
		<div className='flex flex-col gap-3'>
			{result.resolvedOrganizationRole ? (
				<p>
					The <code>{result.claimName}</code> claim resolved to an organization role.
				</p>
			) : (
				<p className='text-muted-foreground'>No organization role was resolved.</p>
			)}
			<dl className='grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2'>
				<dt className='text-muted-foreground'>Organization role</dt>
				<dd>{result.resolvedOrganizationRole ? capitalize(result.resolvedOrganizationRole) : '—'}</dd>
				<dt className='text-muted-foreground'>Groups in token</dt>
				<dd className='flex flex-wrap gap-1'>
					{result.groups.length === 0
						? '—'
						: result.groups.map((group) => (
								<Badge
									key={group}
									variant={result.matchedGroups.includes(group) ? 'success' : 'secondary'}
								>
									{group}
								</Badge>
							))}
				</dd>
				{result.issuedAt && (
					<>
						<dt className='text-muted-foreground'>Issued</dt>
						<dd>{new Date(result.issuedAt).toLocaleString()}</dd>
					</>
				)}
			</dl>
			{result.problem && PROBLEM_HELP[result.problem] && (
				<p className='rounded-md bg-muted px-3 py-2'>{PROBLEM_HELP[result.problem]}</p>
			)}
			{result.claims && (
				<details>
					<summary className='cursor-pointer text-muted-foreground'>All claims</summary>
					<pre className='mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs'>
						{JSON.stringify(result.claims, null, 2)}
					</pre>
				</details>
			)}
		</div>
	);
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ');
}
