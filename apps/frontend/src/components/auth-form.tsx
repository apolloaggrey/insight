import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Mail } from 'lucide-react';
import { trpc } from '../main';
import type { SignInMethod } from '@/lib/last-sign-in-method';
import { Input } from '@/components/ui/input';
import { MicrosoftSignInButton, useIsMicrosoftSetup } from '@/components/auth-microsoft-button';
import { OidcSignInButton } from '@/components/auth-oidc-button';
import { Button, AuthSocialButton } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { LastUsedPill } from '@/components/ui/last-used-pill';
import { Spinner } from '@/components/ui/spinner';
import { buildBrandVars, buildLastUsedPillVars } from '@/components/brand-color';
import GithubIcon from '@/components/icons/github-icon.svg';
import GitlabIcon from '@/components/icons/gitlab-icon.svg';
import GoogleIcon from '@/components/icons/google-icon.svg';
import InsightLogo from '@/components/icons/insight-full-logo.svg';
import { AuthSignalField } from '@/components/auth-signal-field';
import { useIsDarkMode } from '@/contexts/theme.provider';
import { brandingAssetUrl, DEFAULT_BRAND_COLOR, useBranding } from '@/hooks/use-branding';
import { handleGithubSignIn, handleGitlabSignIn, handleGoogleSignIn } from '@/lib/auth-client';
import { loadLastSignInMethod, rememberSignInMethod } from '@/lib/last-sign-in-method';
import { cn } from '@/lib/utils';

interface AuthFormProps {
	form: any;
	title: string;
	description?: string;
	submitText: string;
	children: React.ReactNode;
	serverError?: string;
	displaySocialProviders?: boolean;
	socialCallbackUrl?: string;
	displayEmailPasswordForm?: boolean;
	emailPasswordDisabledMessage?: string;
	footer?: React.ReactNode;
}

export function AuthForm({
	form,
	title,
	description,
	submitText,
	children,
	serverError,
	displaySocialProviders,
	socialCallbackUrl,
	displayEmailPasswordForm = true,
	emailPasswordDisabledMessage,
	footer,
}: AuthFormProps) {
	const branding = useBranding();
	const isDark = useIsDarkMode();
	const customColor = branding.enabled ? branding.brandColor : null;
	const brandVars = customColor
		? (buildBrandVars(customColor, isDark ? 'dark' : 'light') as React.CSSProperties)
		: undefined;
	const brandColor = customColor ?? DEFAULT_BRAND_COLOR;
	const fieldColor = isDark ? `color-mix(in srgb, ${brandColor} 60%, white)` : brandColor;
	const lastUsedPillVars = customColor ? (buildLastUsedPillVars(customColor) as React.CSSProperties) : undefined;

	const [lastSignInMethod] = useState(loadLastSignInMethod);
	const [isEmailFormExpanded, setIsEmailFormExpanded] = useState(lastSignInMethod === 'email');
	const emailFormRef = useRef<HTMLFormElement>(null);
	const { providerButtons, isPending: areProvidersLoading } = useProviderButtons(socialCallbackUrl, lastSignInMethod);

	const areProvidersPending = Boolean(displaySocialProviders && areProvidersLoading);
	const showsProviders = Boolean(displaySocialProviders && !areProvidersPending && providerButtons.length > 0);
	const showEmailForm = !areProvidersPending && displayEmailPasswordForm && (!showsProviders || isEmailFormExpanded);
	const showEmailDisabledMessage = !areProvidersPending && !displayEmailPasswordForm && emailPasswordDisabledMessage;

	const expandEmailForm = () => {
		flushSync(() => setIsEmailFormExpanded(true));
		emailFormRef.current?.querySelector('input')?.focus();
	};

	return (
		<div className='relative flex min-h-screen w-full overflow-hidden' style={lastUsedPillVars}>
			<AuthSignalField color={fieldColor} />
			<div className='relative flex w-full items-center justify-center p-6 lg:w-1/2'>
				<div className='flex w-full max-w-sm flex-col gap-8'>
					<AuthLogo />

					<div className='flex flex-col gap-2'>
						<h1 className='font-borna text-3xl font-medium'>{title}</h1>
						{description && <p className='text-sm text-muted-foreground'>{description}</p>}
					</div>

					<div className='flex flex-col gap-5'>
						{serverError && (
							<div role='alert'>
								<ErrorMessage message={serverError} />
							</div>
						)}

						{showsProviders && (
							<div className='flex flex-col gap-3'>
								{providerButtons}
								{displayEmailPasswordForm && !isEmailFormExpanded && (
									<Button
										type='button'
										variant='outline'
										className='h-11 w-full gap-2.5 rounded-lg text-sm font-medium'
										onClick={expandEmailForm}
									>
										<Mail className='size-4' />
										Continue with email
									</Button>
								)}
							</div>
						)}

						{showsProviders && showEmailForm && <AuthDivider />}

						{showEmailForm && (
							<form
								ref={emailFormRef}
								className='flex flex-col gap-4'
								onSubmit={(e) => {
									e.preventDefault();
									form.handleSubmit();
								}}
							>
								{children}
								<form.Subscribe selector={(state: { isSubmitting: boolean }) => state.isSubmitting}>
									{(isSubmitting: boolean) => (
										<Button
											type='submit'
											variant='primary-gradient'
											className='relative mt-2 h-11 w-full gap-2 rounded-lg'
											style={brandVars}
											disabled={isSubmitting}
										>
											{isSubmitting && <Spinner />}
											{submitText}
											{displaySocialProviders && lastSignInMethod === 'email' && (
												<LastUsedPill className='absolute -top-2 right-3' />
											)}
										</Button>
									)}
								</form.Subscribe>
							</form>
						)}

						{showEmailDisabledMessage && (
							<p className='text-sm text-muted-foreground'>{emailPasswordDisabledMessage}</p>
						)}
					</div>

					{footer && <div className='text-sm text-muted-foreground'>{footer}</div>}
				</div>
			</div>
		</div>
	);
}

interface FormTextFieldProps {
	form: any;
	name: string;
	type?: string;
	title: string;
	placeholder?: string;
	autoComplete?: string;
	minLength?: number;
	hint?: string;
}

export function FormTextField({
	form,
	name,
	type = 'text',
	title,
	placeholder,
	autoComplete,
	minLength,
	hint,
}: FormTextFieldProps) {
	return (
		<form.Field name={name}>
			{(field: { state: { value: string }; handleChange: (v: string) => void; handleBlur: () => void }) => (
				<div className='flex flex-col gap-1.5'>
					<label htmlFor={name} className='text-sm font-medium text-foreground'>
						{title}
					</label>
					<Input
						id={name}
						name={name}
						type={type}
						placeholder={placeholder}
						autoComplete={autoComplete}
						minLength={minLength}
						aria-describedby={hint ? `${name}-hint` : undefined}
						required
						value={field.state.value}
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={field.handleBlur}
						className='h-11 rounded-lg'
					/>
					{hint && (
						<p id={`${name}-hint`} className='text-xs text-muted-foreground'>
							{hint}
						</p>
					)}
				</div>
			)}
		</form.Field>
	);
}

function useProviderButtons(callbackUrl: string | undefined, lastSignInMethod: SignInMethod | null) {
	const isGoogleSetup = useQuery(trpc.authConfig.google.isSetup.queryOptions());
	const isGithubSetup = useQuery(trpc.authConfig.github.isSetup.queryOptions());
	const isGitlabSetup = useQuery(trpc.authConfig.gitlab.isSetup.queryOptions());
	const { isSetup: isMicrosoftSetup, isPending: isMicrosoftSetupPending } = useIsMicrosoftSetup();
	const oidcConfig = useQuery(trpc.authConfig.oidc.getConfig.queryOptions());

	const providerButtons = [
		isGoogleSetup.data && (
			<AuthSocialButton
				key='google'
				icon={GoogleIcon}
				label='Continue with Google'
				onClick={() => {
					rememberSignInMethod('google');
					handleGoogleSignIn(callbackUrl);
				}}
				lastUsed={lastSignInMethod === 'google'}
			/>
		),
		isGithubSetup.data && (
			<AuthSocialButton
				key='github'
				icon={GithubIcon}
				label='Continue with GitHub'
				onClick={() => {
					rememberSignInMethod('github');
					handleGithubSignIn(callbackUrl);
				}}
				lastUsed={lastSignInMethod === 'github'}
			/>
		),
		isGitlabSetup.data && (
			<AuthSocialButton
				key='gitlab'
				icon={GitlabIcon}
				label='Continue with GitLab'
				onClick={() => {
					rememberSignInMethod('gitlab');
					handleGitlabSignIn(callbackUrl);
				}}
				lastUsed={lastSignInMethod === 'gitlab'}
			/>
		),
		isMicrosoftSetup && (
			<MicrosoftSignInButton
				key='microsoft'
				callbackUrl={callbackUrl}
				lastUsed={lastSignInMethod === 'microsoft'}
			/>
		),
		oidcConfig.data && (
			<OidcSignInButton
				key='oidc'
				providerId={oidcConfig.data.providerId}
				providerName={oidcConfig.data.providerName}
				callbackUrl={callbackUrl}
				lastUsed={lastSignInMethod === 'oidc'}
			/>
		),
	].filter(Boolean);

	const isPending =
		isGoogleSetup.isPending ||
		isGithubSetup.isPending ||
		isGitlabSetup.isPending ||
		isMicrosoftSetupPending ||
		oidcConfig.isPending;

	return { providerButtons, isPending };
}

function AuthLogo() {
	const branding = useBranding();
	const customColor = branding.enabled ? branding.brandColor : null;

	if (branding.enabled && branding.hasLogo) {
		return (
			<img
				src={brandingAssetUrl('logo', branding.updatedAt)}
				alt={branding.appName ?? 'Logo'}
				className='h-10 w-auto max-w-[180px] self-start object-contain'
			/>
		);
	}

	return (
		<InsightLogo
			className={cn('h-auto w-20 text-foreground', customColor && '[&_stop]:[stop-color:var(--brand-logo)]')}
			style={customColor ? ({ '--brand-logo': customColor } as React.CSSProperties) : undefined}
		/>
	);
}

function AuthDivider() {
	return (
		<div className='flex items-center gap-3 text-xs text-muted-foreground'>
			<div className='flex-1 border-t' />
			or
			<div className='flex-1 border-t' />
		</div>
	);
}
