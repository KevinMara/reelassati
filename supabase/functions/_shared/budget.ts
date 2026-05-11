import { serviceClient } from './auth.ts'

export async function checkBudget(userId: string, estimatedCostEur: number) {
  const supabase = serviceClient()
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('api_spend_this_cycle_eur, monthly_api_budget_eur, is_unlimited, plan_tier')
    .eq('id', userId)
    .single()
  
  if (!profile) {
    return { allowed: false, reason: 'profile_not_found' }
  }
  
  if (profile.is_unlimited) {
    return { allowed: true, remaining_eur: Infinity }
  }
  
  const remaining = profile.monthly_api_budget_eur - profile.api_spend_this_cycle_eur
  if (remaining < estimatedCostEur) {
    return {
      allowed: false,
      reason: 'budget_exceeded',
      remaining_eur: remaining,
      estimated_cost_eur: estimatedCostEur,
      plan_tier: profile.plan_tier
    }
  }
  
  return { allowed: true, remaining_eur: remaining }
}

export async function logApiUsage(
  userId: string,
  agentName: string,
  actionType: string,
  externalService: string,
  costEur: number,
  metadata: any = {}
) {
  const supabase = serviceClient()
  
  await supabase.from('api_usage_log').insert({
    user_id: userId,
    agent_name: agentName,
    action_type: actionType,
    external_service: externalService,
    cost_eur: costEur,
    metadata
  })
  
  await supabase.rpc('increment_user_spend', {
    user_id: userId,
    amount_eur: costEur
  })
}
