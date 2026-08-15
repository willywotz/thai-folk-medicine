package audit

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/audit"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
)

type stubRepo struct {
	got listing.Params
	out listing.Page[audit.Entry]
}

func (s *stubRepo) Record(context.Context, string, []byte) error { return nil }
func (s *stubRepo) List(_ context.Context, p listing.Params) (listing.Page[audit.Entry], error) {
	s.got = p
	return s.out, nil
}

func TestReaderListDelegatesToRepo(t *testing.T) {
	repo := &stubRepo{out: listing.Page[audit.Entry]{Total: 1}}
	reader := NewReader(repo)

	got, err := reader.List(context.Background(), listing.Params{Limit: 10})

	require.NoError(t, err)
	assert.Equal(t, 1, got.Total)
	assert.Equal(t, 10, repo.got.Limit)
}
