package photo_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/photo"
)

func TestValidOwnerType(t *testing.T) {
	for _, ok := range []string{"province", "district", "healer", "remedy", "case", "herb"} {
		assert.True(t, photo.ValidOwnerType(ok), ok)
	}
	for _, bad := range []string{"", "unknown", "provinces", "Healer"} {
		assert.False(t, photo.ValidOwnerType(bad), bad)
	}
}
