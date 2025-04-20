// NavigationService.ts (or .js if JS)

import { NavigationContainerRef, createNavigationContainerRef } from '@react-navigation/native';
import type { rootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<rootStackParamList>();

export function navigate<RouteName extends keyof rootStackParamList>(
  name: RouteName,
  params?: rootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
