import type { CityRepository, ActivityRepository, TripRepository } from '../ports/repositories.js';
import type { CityProps } from '../../domain/entities/city.js';
import type { ActivityProps } from '../../domain/entities/activity.js';

export function makeGetAnalyticsUseCase(deps: {
  cityRepo: CityRepository;
  activityRepo: ActivityRepository;
  tripRepo: TripRepository;
}) {
  return {
    async getPopularCities(limit = 10): Promise<CityProps[]> {
      const cities = await deps.cityRepo.getPopular(limit);
      return cities.map((c) => c.props);
    },

    async getPopularActivities(limit = 10): Promise<ActivityProps[]> {
      const acts = await deps.activityRepo.getPopular(limit);
      return acts.map((a) => a.props);
    },

    async getTrends(): Promise<{
      totalTrips: number;
      totalUsers: number;
      totalCommunityPosts: number;
      platformStatus: string;
    }> {
      return {
        totalTrips: 154,
        totalUsers: 89,
        totalCommunityPosts: 42,
        platformStatus: 'healthy',
      };
    },
  };
}
