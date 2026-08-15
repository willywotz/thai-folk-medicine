package usecase

import "context"

// LocationCounter counts provinces and districts, satisfied by the location repository.
type LocationCounter interface {
	CountProvince(ctx context.Context) (int, error)
	CountDistrict(ctx context.Context) (int, error)
}

// EntityCounter counts every row of one entity, satisfied by its repository.
type EntityCounter interface {
	Count(ctx context.Context) (int, error)
}

// Stats holds the row totals shown on the staff dashboard.
type Stats struct {
	Provinces int
	Districts int
	Healers   int
	Remedies  int
	Cases     int
	Herbs     int
}

// StatsService aggregates row totals across every entity for the dashboard.
type StatsService struct {
	locations LocationCounter
	healers   EntityCounter
	remedies  EntityCounter
	cases     EntityCounter
	herbs     EntityCounter
}

// NewStatsService builds the stats service.
func NewStatsService(locations LocationCounter, healers, remedies, cases, herbs EntityCounter) *StatsService {
	return &StatsService{locations: locations, healers: healers, remedies: remedies, cases: cases, herbs: herbs}
}

// Get returns the six dashboard totals.
func (s *StatsService) Get(ctx context.Context) (Stats, error) {
	provinces, err := s.locations.CountProvince(ctx)
	if err != nil {
		return Stats{}, err
	}
	districts, err := s.locations.CountDistrict(ctx)
	if err != nil {
		return Stats{}, err
	}
	healers, err := s.healers.Count(ctx)
	if err != nil {
		return Stats{}, err
	}
	remedies, err := s.remedies.Count(ctx)
	if err != nil {
		return Stats{}, err
	}
	cases, err := s.cases.Count(ctx)
	if err != nil {
		return Stats{}, err
	}
	herbs, err := s.herbs.Count(ctx)
	if err != nil {
		return Stats{}, err
	}
	return Stats{
		Provinces: provinces, Districts: districts, Healers: healers,
		Remedies: remedies, Cases: cases, Herbs: herbs,
	}, nil
}
