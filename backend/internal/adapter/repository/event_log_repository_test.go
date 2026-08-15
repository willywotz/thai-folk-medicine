package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

func TestEventLogRecordAndList(t *testing.T) {
	ctx, queries := newTestPool(t)
	repo := NewEventLog(queries)

	require.NoError(t, repo.Record(ctx, "healer.created", []byte(`{"HealerID":1}`)))
	require.NoError(t, repo.Record(ctx, "healer.updated", []byte(`{"HealerID":1}`)))

	page, err := repo.List(ctx, listing.Params{Limit: 10, Offset: 0})

	require.NoError(t, err)
	assert.Equal(t, 2, page.Total)
	require.Len(t, page.Items, 2)
	assert.Equal(t, "healer.updated", page.Items[0].EventName)
	assert.Equal(t, "healer.created", page.Items[1].EventName)
}
