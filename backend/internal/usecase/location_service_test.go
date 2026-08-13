package usecase

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

type fakeLocationRepo struct {
	provinces []location.Province
	districts []location.District
	err       error
}

func (f *fakeLocationRepo) ListProvince(context.Context) ([]location.Province, error) {
	return f.provinces, f.err
}

func (f *fakeLocationRepo) ListDistrictByProvince(_ context.Context, provinceID int64) ([]location.District, error) {
	if f.err != nil {
		return nil, f.err
	}
	var out []location.District
	for _, d := range f.districts {
		if d.ProvinceID == provinceID {
			out = append(out, d)
		}
	}
	return out, nil
}

func TestListProvincePassesThrough(t *testing.T) {
	repo := &fakeLocationRepo{provinces: []location.Province{{ID: 1, NameEnglish: "Yasothon"}}}
	service := NewLocationService(repo)

	got, err := service.ListProvince(context.Background())

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Yasothon", got[0].NameEnglish)
}

func TestListDistrictByProvinceFiltersByProvince(t *testing.T) {
	repo := &fakeLocationRepo{districts: []location.District{
		{ID: 1, ProvinceID: 1, NameEnglish: "Kut Chum"},
		{ID: 2, ProvinceID: 2, NameEnglish: "Other"},
	}}
	service := NewLocationService(repo)

	got, err := service.ListDistrictByProvince(context.Background(), 1)

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Kut Chum", got[0].NameEnglish)
}

func TestListProvinceReturnsRepoError(t *testing.T) {
	repo := &fakeLocationRepo{err: errors.New("db down")}
	service := NewLocationService(repo)

	_, err := service.ListProvince(context.Background())

	assert.Error(t, err)
}
