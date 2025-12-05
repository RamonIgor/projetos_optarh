
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, getDocs, where } from 'firebase/firestore';
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
    
    const activitiesCollection = collection(db, 'activities');
    const q = query(activitiesCollection);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
        .filter(activity => !activity.hasOwnProperty('clientId')); // Filter client-side

      setOrphanActivities(activitiesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orphan activities:", error);
      setOrphanActivities([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, isConsultant]);

  return { orphanActivities, loading };
}

    