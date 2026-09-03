import type { WorkspaceCapabilities } from '../workspace/capabilities'
import { createStudioMutationExecutors } from './mutations'
import {
  STUDIO_WEBMCP_READ_TOOL_NAMES,
  STUDIO_WEBMCP_TOOL_NAMES,
  studioWebMcpInputSchemas,
  studioWebMcpToolMetadata,
  type StudioWebMcpInputSchema,
} from './schemas'
import {
  serializeCurrentResultSummary,
  serializeDatasetInspection,
  serializeWorkspaceState,
  type StudioWebMcpSnapshot,
} from './serializers'

export type WebMcpToolDefinition = {
  name: string
  title: string
  description: string
  inputSchema: StudioWebMcpInputSchema
  annotations: {
    readOnlyHint: boolean
    untrustedContentHint: false
  }
  execute: (input: Record<string, unknown>, options?: { signal: AbortSignal }) => Promise<unknown>
}

export type WebMcpModelContext = {
  registerTool: (
    tool: WebMcpToolDefinition,
    options?: { signal?: AbortSignal }
  ) => Promise<void>
}

type ActiveRegistration = {
  controller: AbortController
}

const activeRegistrations = new WeakMap<object, ActiveRegistration>()
const noop = () => {}

function internalToolFailure(capabilities: WorkspaceCapabilities) {
  const revision = capabilities.getState().runtime.revision
  return {
    ok: false as const,
    previousRevision: revision,
    newRevision: revision,
    error: {
      code: 'internal_tool_error',
      message: 'The Studio tool failed safely. Read the workspace state before retrying.',
    },
  }
}

export function getActiveDocumentModelContext(
  activeDocument: Document
): WebMcpModelContext | null {
  if (!activeDocument.defaultView) return null
  const candidate = (activeDocument as Document & { modelContext?: WebMcpModelContext }).modelContext
  return candidate && typeof candidate.registerTool === 'function' ? candidate : null
}

export function createStudioWebMcpTools(
  readSnapshot: () => StudioWebMcpSnapshot,
  capabilities: WorkspaceCapabilities
): WebMcpToolDefinition[] {
  const mutation = createStudioMutationExecutors(
    readSnapshot().dataset,
    capabilities,
    readSnapshot
  )
  const executeByName = {
    inspect_dataset: () => serializeDatasetInspection(readSnapshot()),
    get_workspace_state: () => serializeWorkspaceState(readSnapshot()),
    get_current_result_summary: () => serializeCurrentResultSummary(readSnapshot()),
    configure_analysis: (input: Record<string, unknown>) => mutation.configureAnalysis(input),
    apply_filters: (input: Record<string, unknown>) => mutation.applyFilters(input),
    set_animation: (input: Record<string, unknown>) => mutation.setAnimation(input),
    reset_view: (input: Record<string, unknown>) => mutation.resetView(input),
  } as const

  return STUDIO_WEBMCP_TOOL_NAMES.map((name) => ({
    name,
    ...studioWebMcpToolMetadata[name],
    inputSchema: studioWebMcpInputSchemas[name],
    annotations: {
      readOnlyHint: STUDIO_WEBMCP_READ_TOOL_NAMES.includes(
        name as typeof STUDIO_WEBMCP_READ_TOOL_NAMES[number]
      ),
      untrustedContentHint: false,
    },
    execute: async (input) => {
      try {
        return await executeByName[name](input)
      } catch {
        return internalToolFailure(capabilities)
      }
    },
  }))
}

export async function registerStudioWebMcpTools(
  modelContext: WebMcpModelContext,
  readSnapshot: () => StudioWebMcpSnapshot,
  capabilities: WorkspaceCapabilities
): Promise<() => void> {
  activeRegistrations.get(modelContext as object)?.controller.abort()
  const registration = { controller: new AbortController() }
  activeRegistrations.set(modelContext as object, registration)

  try {
    for (const tool of createStudioWebMcpTools(readSnapshot, capabilities)) {
      if (registration.controller.signal.aborted) return noop
      await modelContext.registerTool(tool, { signal: registration.controller.signal })
    }
  } catch (error) {
    const lifecycleAbort = registration.controller.signal.aborted
    if (!lifecycleAbort) registration.controller.abort()
    if (activeRegistrations.get(modelContext as object) === registration) {
      activeRegistrations.delete(modelContext as object)
    }
    if (lifecycleAbort) return noop
    throw error
  }

  if (activeRegistrations.get(modelContext as object) !== registration) {
    registration.controller.abort()
    return noop
  }

  return () => {
    if (activeRegistrations.get(modelContext as object) === registration) {
      activeRegistrations.delete(modelContext as object)
      registration.controller.abort()
    }
  }
}
