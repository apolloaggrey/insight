/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useQuery } from '@tanstack/react-query';

import MicrosoftIcon from '@/components/icons/microsoft-icon.svg';
import { AuthSocialButton } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { rememberSignInMethod } from '@/lib/last-sign-in-method';
import { trpc } from '@/main';

export function useIsMicrosoftSetup() {
	const query = useQuery(trpc.authConfig.microsoft.isSetup.queryOptions());
	return { isSetup: query.data === true, isPending: query.isPending };
}

interface MicrosoftSignInButtonProps {
	callbackUrl?: string;
	lastUsed?: boolean;
}

export function MicrosoftSignInButton({ callbackUrl = '/', lastUsed }: MicrosoftSignInButtonProps) {
	return (
		<AuthSocialButton
			icon={MicrosoftIcon}
			label='Continue with Microsoft'
			onClick={() => {
				rememberSignInMethod('microsoft');
				void authClient.signIn.social({
					provider: 'microsoft',
					callbackURL: callbackUrl,
					errorCallbackURL: '/login',
				});
			}}
			lastUsed={lastUsed}
		/>
	);
}
