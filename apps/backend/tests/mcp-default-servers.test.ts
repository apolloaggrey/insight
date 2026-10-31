import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ isCloud: false }));

vi.mock('../src/env', async (importOriginal) => ({
	...(await importOriginal<typeof import('../src/env')>()),
	get isCloud() {
		return mocks.isCloud;
	},
}));

type Definition = { name: string; command: { kind: string; command?: string; args?: string[]; url?: URL } };
const registeredDefinitions: Definition[] = [];

class FakeRuntime {
	registerDefinition(definition: Definition): void {
		registeredDefinitions.push(definition);
	}

	async listTools(): Promise<{ name: string; inputSchema: object }[]> {
		return [{ name: 'browser_navigate', inputSchema: { type: 'object' } }];
	}
}

vi.mock('mcporter', () => ({
	createRuntime: async () => new FakeRuntime(),
}));

vi.mock('../src/db/db', () => ({ db: {} }));

let projectPath = '';

vi.mock('../src/queries/project.queries', () => ({
	retrieveProjectById: async () => ({ path: projectPath }),
	getDisabledMcpServers: async () => [],
	getDisabledMcpTools: async () => [],
	getEnvVars: async () => ({}),
}));

vi.mock('../src/queries/mcp-oauth.queries', () => ({
	claimMcpDiscoveryUser: async () => false,
	deleteMcpUserToken: async () => undefined,
	getMcpOAuthClient: async () => null,
	hasMcpUserToken: async () => false,
}));

vi.mock('../src/services/mcp-oauth', async (importOriginal) => ({
	...(await importOriginal<typeof import('../src/services/mcp-oauth')>()),
	isOAuthServer: async () => false,
}));

import { McpService } from '../src/services/mcp';

const originalPath = process.env.PATH;

async function writeMcpJson(content: string): Promise<void> {
	const mcpsDir = join(projectPath, 'agent', 'mcps');
	await mkdir(mcpsDir, { recursive: true });
	await writeFile(join(mcpsDir, 'mcp.json'), content, 'utf8');
}

async function loadServers(): Promise<McpService> {
	const service = new McpService();
	await service.initializeMcpState('project-1');
	return service;
}

describe('default MCP servers', () => {
	beforeEach(async () => {
		registeredDefinitions.length = 0;
		mocks.isCloud = false;
		projectPath = await mkdtemp(join(tmpdir(), 'insight-mcp-default-'));

		const binDir = await mkdtemp(join(tmpdir(), 'insight-mcp-bin-'));
		await writeFile(join(binDir, 'obscura'), '');
		await chmod(join(binDir, 'obscura'), 0o755);
		process.env.PATH = binDir;
	});

	afterEach(() => {
		process.env.PATH = originalPath;
	});

	it('connects obscura over stdio without any mcp.json', async () => {
		const service = await loadServers();

		expect(service.getConfiguredServerNames()).toEqual(['obscura']);
		expect(registeredDefinitions[0].command).toMatchObject({ kind: 'stdio', command: 'obscura', args: ['mcp'] });
	});

	it('keeps project servers alongside obscura', async () => {
		await writeMcpJson(
			JSON.stringify({
				mcpServers: { remote: { transport: 'streamable-http', url: 'https://mcp.example.com/mcp' } },
			}),
		);

		const service = await loadServers();

		expect(service.getConfiguredServerNames().sort()).toEqual(['obscura', 'remote']);
	});

	it('lets mcp.json replace the default', async () => {
		await writeMcpJson(
			JSON.stringify({ mcpServers: { obscura: { command: 'obscura', args: ['mcp', '--port', '1'] } } }),
		);

		await loadServers();

		expect(registeredDefinitions[0].command.args).toEqual(['mcp', '--port', '1']);
	});

	it('still connects obscura when mcp.json is invalid', async () => {
		await writeMcpJson('{ not json');

		const service = await loadServers();

		expect(service.getConfiguredServerNames()).toEqual(['obscura']);
		expect(await service.getConfigError('project-1')).toContain('Invalid JSON');
	});

	it('leaves obscura out when the binary is not installed', async () => {
		process.env.PATH = await mkdtemp(join(tmpdir(), 'insight-mcp-empty-'));

		const service = await loadServers();

		expect(service.getConfiguredServerNames()).toEqual([]);
		expect(await service.getServersStatus('project-1')).toEqual([]);
	});

	it('leaves obscura out in cloud mode', async () => {
		mocks.isCloud = true;

		const service = await loadServers();

		expect(await service.getServersStatus('project-1')).toEqual([]);
	});
});
