
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { type Activity } from '@/types/activity';
import { useClient } from '@/firebase';

interface UseOrphanActivitiesReturn {
  orphanActivities: Activity[];
  loading: boolean;
}

/**
 * Hook to fetch activities that do not have a clientId.
 * These are considered "orphan" activities from before the multi-client structure.
 * This hook only runs if the user is a consultant.
 */
export function useOrphanActivities(): UseOrphanActivitiesReturn {
  const db = useFirestore();
  const { isConsultant } = useClient();
  const [orphanActivities, setOrphanActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !isConsultant) {
      setLoading(false);
      return;
    }
    
    // This assumes orphan activities are in a root collection named 'activities'
    // and they lack the 'clientId' field.
    const q = query(collection(db, 'activities'), where('clientId', '==', null));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setOrphanActivities(activitiesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orphan activities:", error);
      // This might fail if the collection 'activities' doesn't exist or if there are no security rules for it.
      // For this specific use case, we can fail silently as it's a temporary tool.
      setOrphanActivities([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isConsultant]);

  return { orphanActivities, loading };
}
