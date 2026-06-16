// Root navigation param list — referenced by every screen that calls
// `useNavigation()` or `useRoute()` so the route names are type-checked.
//
// If you add a new route, declare it here AND register the screen in App.tsx.
export type RootStackParamList = {
  Chat: undefined;
  PriceTracker: undefined;
};
