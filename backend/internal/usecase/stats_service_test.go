package usecase

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeLocationCounter struct{ provinces, districts int }

func (f fakeLocationCounter) CountProvince(context.Context) (int, error) { return f.provinces, nil }
func (f fakeLocationCounter) CountDistrict(context.Context) (int, error) { return f.districts, nil }

type fakeEntityCounter int

func (f fakeEntityCounter) Count(context.Context) (int, error) { return int(f), nil }

func TestStatsServiceGetReturnsSixTotals(t *testing.T) {
	svc := NewStatsService(
		fakeLocationCounter{provinces: 1, districts: 9},
		fakeEntityCounter(3), fakeEntityCounter(5), fakeEntityCounter(7), fakeEntityCounter(11),
	)

	got, err := svc.Get(context.Background())

	require.NoError(t, err)
	assert.Equal(t, Stats{Provinces: 1, Districts: 9, Healers: 3, Remedies: 5, Cases: 7, Herbs: 11}, got)
}
