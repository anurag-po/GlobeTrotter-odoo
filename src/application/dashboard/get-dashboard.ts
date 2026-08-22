import type { TripRepository, CityRepository, UserRepository } from '../ports/repositories.js';
import type { TripProps } from '../../domain/entities/trip.js';
import type { CityProps } from '../../domain/entities/city.js';

export interface DashboardOutput {
  welcomeName: string;
  recentTrips: TripProps[];
  recommendedDestinations: CityProps[];
  budgetHighlights: {
    totalPlannedThisYear: string;
    tripsOverBudgetCount: number;
  };
}

export function makeGetDashboardUseCase(deps: {
  tripRepo: TripRepository;
  cityRepo: CityRepository;
  userRepo: UserRepository;
}) {
  return async (userId: string): Promise<DashboardOutput> => {
    const user = await deps.userRepo.findById(userId);
    const recentTrips = await deps.tripRepo.findRecentByUser(userId, 5);
    const popularCities = await deps.cityRepo.getPopular(6);

    return {
      welcomeName: user?.firstName || 'Traveler',
      recentTrips: recentTrips.map((t) => t.props),
      recommendedDestinations: popularCities.map((c) => c.props),
      budgetHighlights: {
        totalPlannedThisYear: '0.00',
        tripsOverBudgetCount: 0,
      },
    };
  };
}
