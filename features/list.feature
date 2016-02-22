Feature: Listing Containers
  Background:
    Given I am using the "Runnable" organization

  Scenario: Listing containers for a repository
    Given the containers:
      | name | repo | branch | status | shortHash |
      | api | Runnable/api | master | Running | beef |
      | fb-1-api | Runnable/api | fb-1 | Stopped | dead |
      | web | Runnable/web | master | Running | cabb |
    When I successfully run `runnable list api`
    Then the output should match "Container\s+Status\s+Container URL"
    And the output should match "api/master\s+Running\s+beef-api-staging-runnable"
    And the output should match "api/fb-1\s+Stopped\s+dead-api-staging-runnable"
    And the output should not match "web/master\s+Running\s+cabb-api-staging-runnable"

  Scenario: Listing a summary of all containers
    Given the containers:
      | name | repo | branch | status | shortHash |
      | api | Runnable/api | master | Running | beef |
      | fb-1-api | Runnable/api | fb-1 | Stopped | dead |
      | redis | | | Running | 43d15 |
    When I successfully run `runnable list`
    Then the output should match "^Repositories\s*\n"
    And the output should match "api\s+2 containers"
    And the output should match "\nServices\s*\n"
    And the output should match "redis\s+1 container"
