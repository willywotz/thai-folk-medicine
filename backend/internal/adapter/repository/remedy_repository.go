package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

// ListByHealer returns a healer's remedies (without herb links, for list views).
func (r *Remedy) ListByHealer(ctx context.Context, healerID int64) ([]remedy.Remedy, error) {
	rows, err := r.q.ListRemedyByHealer(ctx, healerID)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		result = append(result, toRemedy(row))
	}
	return result, nil
}

// ListByHerb returns the remedies that use a herb.
func (r *Remedy) ListByHerb(ctx context.Context, herbID int64) ([]remedy.Remedy, error) {
	rows, err := r.q.ListRemedyByHerb(ctx, herbID)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		result = append(result, toRemedy(row))
	}
	return result, nil
}

// ListPage returns one page of remedies matching the optional filters.
func (r *Remedy) ListPage(ctx context.Context, q remedy.ListQuery) (listing.Page[remedy.Remedy], error) {
	symptom := pgtype.Text{}
	if q.Symptom != "" {
		symptom = pgtype.Text{String: q.Symptom, Valid: true}
	}
	rows, err := r.q.ListRemedyPage(ctx, db.ListRemedyPageParams{
		HerbID:     optInt64(q.HerbID),
		DistrictID: optInt64(q.DistrictID),
		Symptom:    symptom,
		PageLimit:  int32(q.Page.Limit),
		PageOffset: int32(q.Page.Offset),
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	total, err := r.q.CountRemedyPage(ctx, db.CountRemedyPageParams{
		HerbID: optInt64(q.HerbID), DistrictID: optInt64(q.DistrictID), Symptom: symptom,
	})
	if err != nil {
		return listing.Page[remedy.Remedy]{}, err
	}
	items := make([]remedy.Remedy, 0, len(rows))
	for _, row := range rows {
		items = append(items, toRemedy(row))
	}
	return listing.Page[remedy.Remedy]{Items: items, Total: int(total)}, nil
}

// optInt64 converts a nullable int64 pointer to its pgtype form.
func optInt64(p *int64) pgtype.Int8 {
	if p == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *p, Valid: true}
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

// Search returns remedies whose name, symptoms, or linked herb names match.
func (r *Remedy) Search(ctx context.Context, term string) ([]remedy.SearchResult, error) {
	rows, err := r.q.SearchRemedy(ctx, term)
	if err != nil {
		return nil, err
	}
	result := make([]remedy.SearchResult, 0, len(rows))
	for _, row := range rows {
		result = append(result, remedy.SearchResult{
			ID:             row.ID,
			Name:           row.Name,
			Symptoms:       row.Symptoms,
			HealerID:       row.HealerID,
			HealerFullName: row.HealerFullName,
		})
	}
	return result, nil
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
