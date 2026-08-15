package audit

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

type fakeRepo struct {
	name    string
	payload []byte
}

func (f *fakeRepo) Record(_ context.Context, name string, payload []byte) error {
	f.name, f.payload = name, payload
	return nil
}
func (f *fakeRepo) List(context.Context, listing.Params) (listing.Page[audit.Entry], error) {
	return listing.Page[audit.Entry]{}, nil
}

type stubEvent struct{ HealerID int64 }

func (stubEvent) EventName() string { return "healer.created" }

func TestRecorderHandleRecordsNameAndPayload(t *testing.T) {
	repo := &fakeRepo{}
	recorder := NewRecorder(repo)

	err := recorder.Handle(context.Background(), stubEvent{HealerID: 5})

	require.NoError(t, err)
	assert.Equal(t, "healer.created", repo.name)

	var got map[string]any
	require.NoError(t, json.Unmarshal(repo.payload, &got))
	assert.Equal(t, float64(5), got["HealerID"])
}
