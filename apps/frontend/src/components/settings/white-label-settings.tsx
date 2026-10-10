/* Insight: independent implementation (see NOTICE). Apache-2.0. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { LockedFieldset } from '@/components/settings/locked-fieldset';
import { UpgradeToEnterprise } from '@/components/settings/upgrade-to-enterprise';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { SettingsControlRow } from '@/components/ui/settings-toggle-row';
import { brandingAssetUrl, DEFAULT_BRAND_COLOR, useBranding } from '@/hooks/use-branding';
import { trpc } from '@/main';

type AssetKind = 'logo' | 'favicon';

const ASSET_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon';
const MAX_ASSET_BYTES = 512 * 1024;

interface WhiteLabelSettingsProps {
	isAdmin: boolean;
}

export function WhiteLabelSettings({ isAdmin }: WhiteLabelSettingsProps) {
	const branding = useBranding();
	const onSuccess = useRefreshBranding();
	const save = useMutation(trpc.branding.update.mutationOptions({ onSuccess }));
	const reset = useMutation(trpc.branding.reset.mutationOptions({ onSuccess }));
	const [appName, setAppName] = useState('');
	const [tabTitle, setTabTitle] = useState('');
	const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);

	useEffect(() => {
		setAppName(branding.appName ?? '');
		setTabTitle(branding.tabTitle ?? '');
		setBrandColor(branding.brandColor ?? DEFAULT_BRAND_COLOR);
	}, [branding.appName, branding.tabTitle, branding.brandColor]);

	const canEdit = isAdmin && branding.enabled;
	const isDirty =
		appName !== (branding.appName ?? '') ||
		tabTitle !== (branding.tabTitle ?? '') ||
		brandColor !== (branding.brandColor ?? DEFAULT_BRAND_COLOR);

	return (
		<SettingsCard
			title='White label'
			description='Replace the product name, logo, favicon and colour with your own.'
			action={!branding.enabled ? <UpgradeToEnterprise /> : undefined}
		>
			<LockedFieldset disabled={!canEdit}>
				<div className='flex flex-col gap-4'>
					<TextRow
						id='brand-app-name'
						label='App name'
						description='Used in the sidebar, emails and chat messages.'
						value={appName}
						onChange={setAppName}
						placeholder='Insight'
					/>
					<TextRow
						id='brand-tab-title'
						label='Browser tab title'
						description='Shown in the browser tab.'
						value={tabTitle}
						onChange={setTabTitle}
						placeholder='Defaults to the app name'
					/>
					<SettingsControlRow
						id='brand-color'
						label='Brand colour'
						description='Buttons, highlights and the sign-in page.'
						control={
							<div className='flex items-center gap-2'>
								<input
									id='brand-color'
									type='color'
									value={brandColor}
									onChange={(event) => setBrandColor(event.target.value)}
									className='h-8 w-10 cursor-pointer rounded border bg-transparent'
									aria-label='Brand colour'
								/>
								<span className='font-mono text-xs text-muted-foreground'>{brandColor}</span>
							</div>
						}
					/>
					<AssetRow kind='logo' label='Logo' description='Shown in the sidebar, sign-in page and emails.' />
					<AssetRow kind='favicon' label='Favicon' description='The small icon in the browser tab.' />
					<div className='flex justify-end gap-2'>
						<Button variant='ghost' disabled={reset.isPending} onClick={() => reset.mutate()}>
							Reset to defaults
						</Button>
						<Button
							disabled={!isDirty || save.isPending}
							onClick={() =>
								save.mutate({ appName: appName || null, tabTitle: tabTitle || null, brandColor })
							}
						>
							{save.isPending ? 'Saving…' : 'Save'}
						</Button>
					</div>
					{(save.error || reset.error) && (
						<p className='text-sm text-destructive'>{(save.error ?? reset.error)?.message}</p>
					)}
				</div>
			</LockedFieldset>
		</SettingsCard>
	);
}

function AssetRow({ kind, label, description }: { kind: AssetKind; label: string; description: string }) {
	const branding = useBranding();
	const inputRef = useRef<HTMLInputElement>(null);
	const [error, setError] = useState<string | null>(null);
	const onSuccess = useRefreshBranding();
	const upload = useMutation(trpc.branding.uploadAsset.mutationOptions({ onSuccess }));
	const remove = useMutation(trpc.branding.removeAsset.mutationOptions({ onSuccess }));
	const hasAsset = kind === 'logo' ? branding.hasLogo : branding.hasFavicon;

	const handleFile = async (file: File | undefined) => {
		setError(null);
		if (!file) {
			return;
		}
		if (file.size > MAX_ASSET_BYTES) {
			setError('The image must be 512 KB or smaller.');
			return;
		}
		upload.mutate(
			{ kind, data: await readAsBase64(file), mediaType: file.type || 'image/png' },
			{ onError: (mutationError) => setError(mutationError.message) },
		);
	};

	return (
		<SettingsControlRow
			id={`brand-${kind}`}
			label={label}
			description={error ?? description}
			control={
				<div className='flex items-center gap-2'>
					{hasAsset && (
						<img
							src={brandingAssetUrl(kind, branding.updatedAt)}
							alt={`Current ${label.toLowerCase()}`}
							className='size-8 rounded object-contain'
						/>
					)}
					<input
						ref={inputRef}
						id={`brand-${kind}`}
						type='file'
						accept={ASSET_ACCEPT}
						className='hidden'
						onChange={(event) => {
							void handleFile(event.target.files?.[0]);
							event.target.value = '';
						}}
					/>
					<Button
						variant='outline'
						size='sm'
						disabled={upload.isPending}
						onClick={() => inputRef.current?.click()}
					>
						{upload.isPending ? 'Uploading…' : hasAsset ? 'Replace' : 'Upload'}
					</Button>
					{hasAsset && (
						<Button
							variant='ghost'
							size='sm'
							disabled={remove.isPending}
							onClick={() => remove.mutate({ kind })}
						>
							Remove
						</Button>
					)}
				</div>
			}
		/>
	);
}

interface TextRowProps {
	id: string;
	label: string;
	description: string;
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
}

function TextRow(props: TextRowProps) {
	return (
		<SettingsControlRow
			id={props.id}
			label={props.label}
			description={props.description}
			control={
				<Input
					id={props.id}
					value={props.value}
					placeholder={props.placeholder}
					maxLength={80}
					onChange={(event) => props.onChange(event.target.value)}
					className='w-64'
				/>
			}
		/>
	);
}

function useRefreshBranding() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: trpc.branding.get.queryKey() });
}

function readAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
