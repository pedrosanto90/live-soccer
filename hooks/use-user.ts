'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

interface UseUserResult {
  user: User | null
  profile: Profile | null
  isLoading: boolean
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function loadProfile(currentUser: User | null) {
      if (!currentUser) {
        if (active) setProfile(null)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()
      if (active) setProfile(data ?? null)
    }

    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      if (!active) return
      setUser(currentUser)
      await loadProfile(currentUser)
      if (active) setIsLoading(false)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      loadProfile(currentUser)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, profile, isLoading }
}
