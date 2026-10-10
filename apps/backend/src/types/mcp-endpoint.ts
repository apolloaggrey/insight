import type { LlmSelectedModel } from '@insight/shared/types';

export interface McpEndpointSettings {
	enabled: boolean;
	subAgentModeEnabled: boolean;
	contextLayerModeEnabled: boolean;
	/** The model `ask_insight` runs on; null or unset follows the project's default chat model. */
	subAgentModel?: LlmSelectedModel | null;
}

export const DEFAULT_MCP_ENDPOINT_SETTINGS: McpEndpointSettings = {
	enabled: false,
	subAgentModeEnabled: true,
	contextLayerModeEnabled: true,
};
