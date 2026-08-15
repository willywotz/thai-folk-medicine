package location

// ProvinceCreatedEvent is published after a province is created.
type ProvinceCreatedEvent struct {
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// EventName identifies the event kind.
func (ProvinceCreatedEvent) EventName() string { return "province.created" }

// ProvinceUpdatedEvent is published after a province is updated.
type ProvinceUpdatedEvent struct {
	ProvinceID  int64
	NameThai    string
	NameEnglish string
}

// EventName identifies the event kind.
func (ProvinceUpdatedEvent) EventName() string { return "province.updated" }

// ProvinceDeletedEvent is published after a province is deleted.
type ProvinceDeletedEvent struct{ ProvinceID int64 }

// EventName identifies the event kind.
func (ProvinceDeletedEvent) EventName() string { return "province.deleted" }
