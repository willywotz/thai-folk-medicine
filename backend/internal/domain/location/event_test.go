package location_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/location"
)

func TestProvinceEventNames(t *testing.T) {
	assert.Equal(t, "province.created", location.ProvinceCreatedEvent{}.EventName())
	assert.Equal(t, "province.updated", location.ProvinceUpdatedEvent{}.EventName())
	assert.Equal(t, "province.deleted", location.ProvinceDeletedEvent{}.EventName())
}

func TestDistrictEventNames(t *testing.T) {
	assert.Equal(t, "district.created", location.DistrictCreatedEvent{}.EventName())
	assert.Equal(t, "district.updated", location.DistrictUpdatedEvent{}.EventName())
	assert.Equal(t, "district.deleted", location.DistrictDeletedEvent{}.EventName())
}
