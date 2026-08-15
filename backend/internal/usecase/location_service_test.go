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

	createdProvince   location.Province
	districtCount     int
	deleteProvinceErr error

	healerCount       int
	deleteDistrictErr error
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

func (f *fakeLocationRepo) GetDistrict(_ context.Context, id int64) (location.District, error) {
	if f.err != nil {
		return location.District{}, f.err
	}
	for _, d := range f.districts {
		if d.ID == id {
			return d, nil
		}
	}
	return location.District{}, location.ErrNotFound
}

func (f *fakeLocationRepo) GetProvince(_ context.Context, id int64) (location.Province, error) {
	for _, p := range f.provinces {
		if p.ID == id {
			return p, nil
		}
	}
	return location.Province{}, location.ErrProvinceNotFound
}

func (f *fakeLocationRepo) CreateProvince(_ context.Context, nameThai, nameEnglish string) (location.Province, error) {
	if f.err != nil {
		return location.Province{}, f.err
	}
	f.createdProvince = location.Province{ID: 1, NameThai: nameThai, NameEnglish: nameEnglish}
	return f.createdProvince, nil
}

func (f *fakeLocationRepo) UpdateProvince(_ context.Context, id int64, nameThai, nameEnglish string) (location.Province, error) {
	if f.err != nil {
		return location.Province{}, f.err
	}
	return location.Province{ID: id, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) DeleteProvince(context.Context, int64) error {
	return f.deleteProvinceErr
}

func (f *fakeLocationRepo) CountDistrictByProvince(context.Context, int64) (int, error) {
	return f.districtCount, nil
}

func (f *fakeLocationRepo) CreateDistrict(_ context.Context, provinceID int64, nameThai, nameEnglish string) (location.District, error) {
	if f.err != nil {
		return location.District{}, f.err
	}
	return location.District{ID: 1, ProvinceID: provinceID, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) UpdateDistrict(_ context.Context, id int64, nameThai, nameEnglish string) (location.District, error) {
	if f.err != nil {
		return location.District{}, f.err
	}
	return location.District{ID: id, NameThai: nameThai, NameEnglish: nameEnglish}, nil
}

func (f *fakeLocationRepo) DeleteDistrict(context.Context, int64) error {
	return f.deleteDistrictErr
}

func (f *fakeLocationRepo) CountHealerByDistrict(context.Context, int64) (int, error) {
	return f.healerCount, nil
}

func TestListProvincePassesThrough(t *testing.T) {
	repo := &fakeLocationRepo{provinces: []location.Province{{ID: 1, NameEnglish: "Yasothon"}}}
	service := NewLocationService(repo, &recordingPublisher{})

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
	service := NewLocationService(repo, &recordingPublisher{})

	got, err := service.ListDistrictByProvince(context.Background(), 1)

	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "Kut Chum", got[0].NameEnglish)
}

func TestListProvinceReturnsRepoError(t *testing.T) {
	repo := &fakeLocationRepo{err: errors.New("db down")}
	service := NewLocationService(repo, &recordingPublisher{})

	_, err := service.ListProvince(context.Background())

	assert.Error(t, err)
}

func TestCreateProvincePublishesCreatedEvent(t *testing.T) {
	repo := &fakeLocationRepo{}
	pub := &recordingPublisher{}
	service := NewLocationService(repo, pub)

	got, err := service.CreateProvince(context.Background(), "อุบล", "Ubon")

	require.NoError(t, err)
	assert.Equal(t, "Ubon", got.NameEnglish)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "province.created", pub.events[0].EventName())
}

func TestUpdateProvincePublishesUpdatedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewLocationService(&fakeLocationRepo{}, pub)

	_, err := service.UpdateProvince(context.Background(), 3, "อุบล", "Ubon")

	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "province.updated", pub.events[0].EventName())
}

func TestDeleteProvincePublishesDeletedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewLocationService(&fakeLocationRepo{}, pub)

	err := service.DeleteProvince(context.Background(), 3)

	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "province.deleted", pub.events[0].EventName())
}

func TestDeleteProvinceRejectsWhenDistrictsExist(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewLocationService(&fakeLocationRepo{districtCount: 2}, pub)

	err := service.DeleteProvince(context.Background(), 3)

	assert.ErrorIs(t, err, location.ErrProvinceReferenced)
	assert.Empty(t, pub.events, "no event when the guard rejects the delete")
}

func TestGetProvincePassesThrough(t *testing.T) {
	repo := &fakeLocationRepo{provinces: []location.Province{{ID: 1, NameEnglish: "Yasothon"}}}
	service := NewLocationService(repo, &recordingPublisher{})

	got, err := service.GetProvince(context.Background(), 1)

	require.NoError(t, err)
	assert.Equal(t, "Yasothon", got.NameEnglish)
}

func TestCreateDistrictPublishesCreatedEvent(t *testing.T) {
	repo := &fakeLocationRepo{}
	pub := &recordingPublisher{}
	service := NewLocationService(repo, pub)

	got, err := service.CreateDistrict(context.Background(), 1, "กุดชุม", "Kut Chum")

	require.NoError(t, err)
	assert.Equal(t, "Kut Chum", got.NameEnglish)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "district.created", pub.events[0].EventName())
}

func TestUpdateDistrictPublishesUpdatedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewLocationService(&fakeLocationRepo{}, pub)

	_, err := service.UpdateDistrict(context.Background(), 5, "กุดชุม", "Kut Chum")

	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "district.updated", pub.events[0].EventName())
}

func TestDeleteDistrictPublishesDeletedEvent(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewLocationService(&fakeLocationRepo{}, pub)

	err := service.DeleteDistrict(context.Background(), 5)

	require.NoError(t, err)
	require.Len(t, pub.events, 1)
	assert.Equal(t, "district.deleted", pub.events[0].EventName())
}

func TestDeleteDistrictRejectsWhenHealersExist(t *testing.T) {
	pub := &recordingPublisher{}
	service := NewLocationService(&fakeLocationRepo{healerCount: 2}, pub)

	err := service.DeleteDistrict(context.Background(), 5)

	assert.ErrorIs(t, err, location.ErrDistrictReferenced)
	assert.Empty(t, pub.events, "no event when the guard rejects the delete")
}
