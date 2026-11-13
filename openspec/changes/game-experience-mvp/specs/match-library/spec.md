## MODIFIED Requirements

### Requirement: ML-13 Database-derived classification statistics
The library SHALL show global total matches, total committed screenshots, fully classified screenshots, screenshots awaiting classification and eligible counts for Easy, Medium and Hard. Fully classified SHALL require an existing association and both valid classification inputs, independently of review, metadata completeness and asset readiness. Awaiting classification SHALL equal total committed screenshots minus fully classified. Eligible counts SHALL additionally apply SR-05/SR-06. Counts SHALL be derived from one coherent observation of current records/assets, include retained rejected screenshots in appropriate totals, exclude staging, and remain global when dashboard filters change. No theoretical nine-cell percentage SHALL be substituted for actual data.

#### Scenario: Classification and eligibility differ
- **WHEN** some fully classified screenshots are pending, rejected, missing images or associated with incomplete identifying metadata
- **THEN** they contribute to fully classified totals and calculated-tier distribution but not eligible tier totals

#### Scenario: Parent or screenshot classification changes
- **WHEN** either classification input is saved or cleared
- **THEN** statistics and corresponding eligible pools reflect the revised derived tiers on refresh without manual per-screenshot tier updates

#### Scenario: Empty library or uncertain storage
- **WHEN** the library is empty or current asset readiness cannot be established due to storage errors
- **THEN** an empty library returns zero counts without divide-by-zero percentages, and uncertain storage returns an explicit failure instead of fabricated eligible totals

