import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type MembershipStatus = 'free' | 'subscribed';

export type MembershipState = {
  isAdmin: boolean;
  membershipStatus: MembershipStatus;
  hasMembership: boolean;
  loading: boolean;
};

/**
 * Returns whether the current user has access to membership features.
 * Admins always have access. Subscribed users have access.
 */
export function useMembership(): MembershipState {
  const [state, setState] = useState<MembershipState>({
    isAdmin: false,
    membershipStatus: 'free',
    hasMembership: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setState({ isAdmin: false, membershipStatus: 'free', hasMembership: false, loading: false });
          return;
        }

        const { data: p } = await supabase
          .from('profiles')
          .select('is_admin, membership_status')
          .eq('user_id', user.id)
          .maybeSingle();

        const isAdmin = p?.is_admin === true;
        const membershipStatus = (p?.membership_status === 'subscribed' ? 'subscribed' : 'free') as MembershipStatus;
        const hasMembership = isAdmin || membershipStatus === 'subscribed';

        if (!cancelled) {
          setState({ isAdmin, membershipStatus, hasMembership, loading: false });
        }
      } catch {
        if (!cancelled) setState({ isAdmin: false, membershipStatus: 'free', hasMembership: false, loading: false });
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return state;
}
