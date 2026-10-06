import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { runComparisonSchema, subscriptionSchema, type Frequency } from './schemas/searchCompare'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

/** Which records are new, gone or kept between an earlier run and a later one, as lists of corpus ids. */
export async function compareRunsFull(projectId: number, earlier: number, later: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/search-runs/compare`, { method: 'POST', body: { run_id_1: earlier, run_id_2: later }, schema: runComparisonSchema, signal })
  return data
}

export async function listSubscriptions(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/search-subscriptions`, { schema: z.array(subscriptionSchema), signal })
  return data
}

/** Subscribes the signed-in person to a saved query (or changes how often, if they already are). Always active. */
export async function subscribe(projectId: number, savedQueryId: number, frequency: Frequency) {
  const { data } = await api(`/projects/${projectId}/search-subscriptions`, { method: 'POST', body: { saved_query_id: savedQueryId, frequency }, schema: subscriptionSchema })
  if (data.saved_query_id !== savedQueryId) throw notKept('subscription')
  if (data.frequency !== frequency) throw notKept('frequency')
  if (!data.is_active) throw notKept('subscription')
  return data
}

/** Flips on/off. The server has no "set"; so the caller says which state it expects and the answer is checked against it. */
export async function toggleSubscription(projectId: number, id: number, expectActive: boolean) {
  const { data } = await api(`/projects/${projectId}/search-subscriptions/${id}/toggle`, { method: 'PATCH', schema: subscriptionSchema })
  if (data.is_active !== expectActive) throw notKept('subscription state')
  return data
}
