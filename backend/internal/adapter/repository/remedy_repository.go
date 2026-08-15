package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/willywotz/thai-folk-medicine/backend/internal/adapter/repository/db"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/listing"
	"github.com/willywotz/thai-folk-medicine/backend/internal/domain/remedy"
)

// Remedy stores and reads remedies (and their herb links) in Postgres.
type Remedy struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// NewRemedy builds the remedy repository. It needs the pool to run the
// remedy + remedy_herb writes in one transaction.
func NewRemedy(pool *pgxpool.Pool) *Remedy {
	return &Remedy{pool: pool, q: db.New(pool)}
}

func toRemedy(row db.Remedy) remedy.Remedy {
	return remedy.Remedy{
		ID:                row.ID,
		HealerID:          row.HealerID,
		Name:              row.Name,
		Symptoms:          row.Symptoms,
		PreparationMethod: row.PreparationMethod,
		Usage:             row.Usage,
		Note:              row.Note,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}

func (r *Remedy) loadHerbs(ctx context.Context, remedyID int64) ([]remedy.HerbLink, error) {
	rows, err := r.q.ListHerbByRemedy(ctx, remedyID)
	if err != nil {
		return nil, err
	}
	links := make([]remedy.HerbLink, 0, len(rows))
	for _, row := range rows {
		links = append(links, remedy.HerbLink{
			HerbID:      row.HerbID,
			NameThai:    row.NameThai,
			NameEnglish: row.NameEnglish,
			Amount:      row.Amount,
		})
	}
	return links, nil
}

// Create inserts a remedy and its herb links in one transaction.
func (r *Remedy) Create(ctx context.Context, p remedy.CreateParams) (remedy.Remedy, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return remedy.Remedy{}, err
	}
	defer tx.Rollback(ctx)
	qtx := r.q.WithTx(tx)

	row, err := qtx.CreateRemedy(ctx, db.CreateRemedyParams{
		HealerID:          p.HealerID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		return remedy.Remedy{}, err
	}
	if err := insertHerbLinks(ctx, qtx, row.ID, p.Herbs); err != nil {
		return remedy.Remedy{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return remedy.Remedy{}, err
	}
	out := toRemedy(row)
	out.Herbs, err = r.loadHerbs(ctx, row.ID)
	if err != nil {
		return remedy.Remedy{}, err
	}
	return out, nil
}

// GetByID returns one remedy with its herb links, or remedy.ErrNotFound.
func (r *Remedy) GetByID(ctx context.Context, id int64) (remedy.Remedy, error) {
	row, err := r.q.GetRemedy(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	out := toRemedy(row)
	out.Herbs, err = r.loadHerbs(ctx, id)
	if err != nil {
		return remedy.Remedy{}, err
	}
	return out, nil
}

// ListByHealerPage returns one page of a healer's remedies (without herb
// links, for list views).
func (r *Remedy) ListByHealerPage(ctx context.Context, healerID int64, p listing.Params) (listing.Page[remedy.Remedy], error) {
	rows, err := r.q.ListRemedyByHealerPage(ctx, db.ListRemedyByHealerPageParams{
		HealerID: healerID, PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	total, err := r.q.CountRemedyByHealer(ctx, healerID)
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	items := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		items = append(items, toRemedy(row))
	}
	return listing.Page[remedy.Remedy]{Items: items, Total: int(total)}, nil
}

// ListByHerbPage returns one page of the remedies that use a herb.
func (r *Remedy) ListByHerbPage(ctx context.Context, herbID int64, p listing.Params) (listing.Page[remedy.Remedy], error) {
	rows, err := r.q.ListRemedyByHerbPage(ctx, db.ListRemedyByHerbPageParams{
		HerbID: herbID, PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	total, err := r.q.CountRemedyByHerb(ctx, herbID)
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	items := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		items = append(items, toRemedy(row))
	}
	return listing.Page[remedy.Remedy]{Items: items, Total: int(total)}, nil
}

// ListPage returns one page of remedies, most recent first.
func (r *Remedy) ListPage(ctx context.Context, p listing.Params) (listing.Page[remedy.Remedy], error) {
	rows, err := r.q.ListRemedyPage(ctx, db.ListRemedyPageParams{
		PageLimit: int32(p.Limit), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	total, err := r.q.CountRemedyPage(ctx)
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	items := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		items = append(items, toRemedy(row))
	}
	return listing.Page[remedy.Remedy]{Items: items, Total: int(total)}, nil
}

// Update changes a remedy and replaces its herb links in one transaction.
func (r *Remedy) Update(ctx context.Context, p remedy.UpdateParams) (remedy.Remedy, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return remedy.Remedy{}, err
	}
	defer tx.Rollback(ctx)
	qtx := r.q.WithTx(tx)

	row, err := qtx.UpdateRemedy(ctx, db.UpdateRemedyParams{
		ID:                p.ID,
		Name:              p.Name,
		Symptoms:          p.Symptoms,
		PreparationMethod: p.PreparationMethod,
		Usage:             p.Usage,
		Note:              p.Note,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return remedy.Remedy{}, remedy.ErrNotFound
		}
		return remedy.Remedy{}, err
	}
	if err := qtx.DeleteRemedyHerbByRemedy(ctx, p.ID); err != nil {
		return remedy.Remedy{}, err
	}
	if err := insertHerbLinks(ctx, qtx, p.ID, p.Herbs); err != nil {
		return remedy.Remedy{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return remedy.Remedy{}, err
	}
	out := toRemedy(row)
	out.Herbs, err = r.loadHerbs(ctx, p.ID)
	if err != nil {
		return remedy.Remedy{}, err
	}
	return out, nil
}

// Delete removes a remedy, or returns remedy.ErrNotFound / remedy.ErrReferenced.
func (r *Remedy) Delete(ctx context.Context, id int64) error {
	rows, err := r.q.DeleteRemedy(ctx, id)
	if err != nil {
		if isForeignKeyViolation(err) {
			return remedy.ErrReferenced
		}
		return err
	}
	if rows == 0 {
		return remedy.ErrNotFound
	}
	return nil
}

func insertHerbLinks(ctx context.Context, qtx *db.Queries, remedyID int64, refs []remedy.HerbRef) error {
	for i, ref := range refs {
		if err := qtx.InsertRemedyHerb(ctx, db.InsertRemedyHerbParams{
			RemedyID: remedyID,
			HerbID:   ref.HerbID,
			Amount:   ref.Amount,
			Position: int32(i),
		}); err != nil {
			return err
		}
	}
	return nil
}
