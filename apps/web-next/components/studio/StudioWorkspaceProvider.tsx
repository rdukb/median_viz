'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { executeAnalyticalQuery } from '@/lib/analysis/query'
import type { AnalyticalQueryResult } from '@/lib/analysis/types'
import { studioFixtureDataset, reportDates } from '@/lib/dataset/linkedin-staging-fixture'
import type { DemographicDataset } from '@/lib/dataset/types'
import {
  createWorkspaceCapabilities,
  type WorkspaceCapabilities,
} from '@/lib/workspace/capabilities'
import {
  createInitialWorkspaceState,
  createWorkspaceReducer,
} from '@/lib/workspace/reducer'
import {
  datesInWorkspaceRange,
  workspaceStateToQuery,
} from '@/lib/workspace/selectors'
import type { WorkspaceState } from '@/lib/workspace/types'
import {
  getActiveDocumentModelContext,
  registerStudioWebMcpTools,
} from '@/lib/webmcp/register-tools'

type StudioWorkspaceContextValue = {
  dataset: DemographicDataset
  state: WorkspaceState
  capabilities: WorkspaceCapabilities
  activeResult: AnalyticalQueryResult
  rangeResult: AnalyticalQueryResult
  availableFrames: string[]
}

const StudioWorkspaceContext = createContext<StudioWorkspaceContextValue | null>(null)

export function StudioWorkspaceProvider({
  children,
  dataset = studioFixtureDataset,
}: {
  children: ReactNode
  dataset?: DemographicDataset
}) {
  const initialState = useMemo(() => createInitialWorkspaceState(dataset), [dataset])
  const reducer = useMemo(() => createWorkspaceReducer(initialState), [initialState])
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const capabilities = useMemo(
    () => createWorkspaceCapabilities({
      getState: () => stateRef.current,
      dispatch: (action) => {
        stateRef.current = reducer(stateRef.current, action)
        dispatch(action)
      },
    }),
    [reducer]
  )

  const activeResult = useMemo(
    () => executeAnalyticalQuery(dataset, workspaceStateToQuery(state)),
    [dataset, state]
  )
  const rangeResult = useMemo(
    () => executeAnalyticalQuery(
      dataset,
      workspaceStateToQuery(state, { ignoreAnimation: true })
    ),
    [dataset, state]
  )
  const availableFrames = useMemo(
    () => datesInWorkspaceRange(state, reportDates),
    [state]
  )

  useEffect(() => {
    if (!state.animation.playing || availableFrames.length < 2) return
    const timer = window.setInterval(
      () => capabilities.advanceAnimationFrame(availableFrames),
      1050
    )
    return () => window.clearInterval(timer)
  }, [availableFrames, capabilities, state.animation.playing])

  useEffect(() => {
    const modelContext = getActiveDocumentModelContext(document)
    if (!modelContext) return
    let disposed = false
    let unregister: (() => void) | null = null
    void registerStudioWebMcpTools(modelContext, () => {
      const currentState = capabilities.getState()
      return {
        dataset,
        state: currentState,
        result: executeAnalyticalQuery(dataset, workspaceStateToQuery(currentState)),
      }
    }, capabilities).then((cleanup) => {
      if (disposed) cleanup()
      else unregister = cleanup
    }).catch(() => {
      // WebMCP is experimental. Registration failure must not break Studio.
    })
    return () => {
      disposed = true
      unregister?.()
    }
  }, [capabilities, dataset])

  const value = useMemo(
    () => ({
      dataset,
      state,
      capabilities,
      activeResult,
      rangeResult,
      availableFrames,
    }),
    [activeResult, availableFrames, capabilities, dataset, rangeResult, state]
  )

  return (
    <StudioWorkspaceContext.Provider value={value}>
      {children}
    </StudioWorkspaceContext.Provider>
  )
}

export function useStudioWorkspace() {
  const value = useContext(StudioWorkspaceContext)
  if (!value) {
    throw new Error('useStudioWorkspace must be used inside StudioWorkspaceProvider.')
  }
  return value
}
