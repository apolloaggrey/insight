// @vitest-environment jsdom

import { useForm } from '@tanstack/react-form';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthForm, FormTextField } from './auth-form';

const providerSetup = vi.hoisted(() => ({ google: false }));

vi.mock('@tanstack/react-query', () => ({
	useQuery: ({ data }: { data: unknown }) => ({ data, isPending: false }),
}));
vi.mock('@/main', () => ({
	trpc: {
		authConfig: {
			google: { isSetup: { queryOptions: () => ({ data: providerSetup.google }) } },
			github: { isSetup: { queryOptions: () => ({ data: false }) } },
			gitlab: { isSetup: { queryOptions: () => ({ data: false }) } },
			microsoft: { isSetup: { queryOptions: () => ({ data: false }) } },
			oidc: { getConfig: { queryOptions: () => ({ data: null }) } },
		},
	},
}));
vi.mock('@/hooks/use-branding', () => ({
	DEFAULT_BRAND_COLOR: '#522bff',
	brandingAssetUrl: () => '',
	useBranding: () => ({ enabled: false }),
}));
vi.mock('@/contexts/theme.provider', () => ({ useIsDarkMode: () => false }));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));

function TestForm({ onSubmit = vi.fn(), ...props }: { onSubmit?: () => void; serverError?: string }) {
	const form = useForm({ defaultValues: { email: '' }, onSubmit });
	return (
		<AuthForm form={form} title='Welcome back' submitText='Log in' displaySocialProviders {...props}>
			<FormTextField form={form} name='email' type='email' title='Email' />
		</AuthForm>
	);
}

describe('AuthForm', () => {
	afterEach(() => {
		cleanup();
		localStorage.clear();
		providerSetup.google = false;
	});

	it('shows the email form directly when no provider is configured', () => {
		render(<TestForm />);
		expect(screen.getByLabelText('Email')).toBeDefined();
		expect(screen.queryByRole('button', { name: 'Continue with email' })).toBeNull();
	});

	it('hides the email form behind a button until asked for when providers exist', () => {
		providerSetup.google = true;
		render(<TestForm />);
		expect(screen.queryByLabelText('Email')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

		expect(document.activeElement).toBe(screen.getByLabelText('Email'));
		expect(screen.queryByRole('button', { name: 'Continue with email' })).toBeNull();
	});

	it('opens the email form straight away when email was the last used method', () => {
		providerSetup.google = true;
		localStorage.setItem('insight:last-sign-in-method', 'email');
		render(<TestForm />);
		expect(screen.getByLabelText('Email')).toBeDefined();
		expect(screen.getByText('Last used')).toBeDefined();
	});

	it('announces server errors', () => {
		render(<TestForm serverError='Invalid credentials' />);
		expect(screen.getByRole('alert').textContent).toBe('Invalid credentials');
	});

	it('submits through the form handler', async () => {
		const onSubmit = vi.fn();
		render(<TestForm onSubmit={onSubmit} />);
		fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'you@company.com' } });
		fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
	});
});
