# Tasks: Automated Test Suite for Start Server Script

**Input**: Design documents from `/specs/001-automated-test-suite/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as this is a testing framework implementation - each user story includes test implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Testing framework**: `tests/` at repository root with bats/, helpers/, fixtures/ subdirectories
- All paths follow the structure defined in plan.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test suite project initialization and basic structure

- [x] T001 Create tests directory structure per implementation plan
- [x] T002 Install BATS framework and verify version 1.0+ compatibility
- [x] T003 [P] Configure test environment and Docker prerequisites validation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core test infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create test data structures (Test Case, Test Suite, Test Result, Log Entry) in tests/helpers/common.bash
- [x] T005 Implement Docker helper functions in tests/helpers/docker-helpers.bash
- [x] T006 Create test fixtures and sample configurations in tests/fixtures/
- [x] T007 Setup test result logging and reporting infrastructure
- [x] T008 Configure test execution environment and cleanup mechanisms

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story Implementation (In Progress)

### User Story 1: Script Execution Validation

**Goal**: Verify start-server.sh script executes successfully for valid modpack inputs

**Independent Test**: Run test suite against single valid modpack and verify script exits with success code and expected output

### Implementation for User Story 1

- [x] T009 Create test for script execution with valid configuration
- [ ] T010 [US1] Implement test for valid modpack input validation in tests/bats/start-server.bats
- [ ] T011 [US1] Add test for successful script completion and exit codes in tests/bats/start-server.bats
- [ ] T012 [US1] Implement log message validation for successful execution in tests/bats/start-server.bats

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Validate Docker Container Creation and Persistence (Priority: P2)

**Goal**: Verify Docker containers are created correctly and remain running after server startup

**Independent Test**: Start server and monitor Docker container status independently of other test scenarios

### Implementation for User Story 2

- [ ] T013 [US2] Create docker-integration.bats test file for container lifecycle tests
- [ ] T014 [US2] Implement test for Docker container creation after script execution in tests/bats/docker-integration.bats
- [ ] T015 [US2] Add test for container running state validation in tests/bats/docker-integration.bats
- [ ] T016 [US2] Implement 30-second container persistence monitoring in tests/bats/docker-integration.bats

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Test Error Handling and Validation (Priority: P3)

**Goal**: Test system error handling for invalid inputs and missing dependencies

**Independent Test**: Run tests with invalid inputs and verify appropriate error messages and exit codes

### Implementation for User Story 3

- [ ] T017 [US3] Create error-handling.bats test file for error scenario validation
- [ ] T018 [US3] Implement test for invalid modpack name error handling in tests/bats/error-handling.bats
- [ ] T019 [US3] Add test for missing dependencies detection in tests/bats/error-handling.bats
- [ ] T020 [US3] Implement Docker daemon not running error test in tests/bats/error-handling.bats
- [ ] T021 [US3] Add Docker image not found error test in tests/bats/error-handling.bats
- [ ] T022 [US3] Implement port conflict error handling test in tests/bats/error-handling.bats

**Checkpoint**: All core user stories should now be independently functional

---

## Phase 6: User Story 4 - Generate Test Reports and Logs (Priority: P3)

**Goal**: Provide clear test reporting and logging for automated test suite

**Independent Test**: Run test suite and verify output format and log generation

### Implementation for User Story 4

- [ ] T023 [US4] Enhance test result reporting with pass/fail status display
- [ ] T024 [US4] Implement detailed error logging for failed tests in tests/helpers/common.bash
- [ ] T025 [US4] Add structured log generation with timestamps and context
- [ ] T026 [US4] Implement 100KB log size limit enforcement per test run
- [ ] T027 [US4] Create test summary reporting with execution metrics

**Checkpoint**: Complete test suite with comprehensive reporting and logging

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation across all user stories

- [ ] T028 [P] Documentation updates in docs/ and README updates
- [ ] T029 Code cleanup and bash script optimization
- [ ] T030 Performance validation (5-minute execution limit)
- [ ] T031 [P] Additional integration tests for edge cases
- [ ] T032 Security validation (no authentication requirements)
- [ ] T033 Run quickstart.md validation and update as needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P3)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of other stories
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of other stories
- **User Story 4 (P3)**: Can start after Foundational (Phase 2) - Independent of other stories

### Within Each User Story

- Implementation tasks are sequential within each story
- Stories should be independently testable and deployable
- Core functionality before advanced features

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 3 (Error Handling)

```bash
# Launch error handling tests in parallel:
Task: "Implement test for invalid modpack name error handling in tests/bats/error-handling.bats"
Task: "Add test for missing dependencies detection in tests/bats/error-handling.bats"
Task: "Implement Docker daemon not running error test in tests/bats/error-handling.bats"
Task: "Add Docker image not found error test in tests/bats/error-handling.bats"
Task: "Implement port conflict error handling test in tests/bats/error-handling.bats"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test script execution → Deploy/Demo (MVP!)
3. Add User Story 2 → Test container validation → Deploy/Demo
4. Add User Story 3 → Test error handling → Deploy/Demo
5. Add User Story 4 → Test reporting → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (script execution)
   - Developer B: User Story 2 (container validation)
   - Developer C: User Stories 3 & 4 (error handling & reporting)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Test suite implementation follows BATS best practices and Docker testing patterns
