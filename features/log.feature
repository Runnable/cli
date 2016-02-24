Feature: Viewing Logs
  Background:
    Given the containers:
      | name | repo | branch | status | shortHash |
      | foo | Runnable/foo | master | Running | dead |
      | bar-foo | Runnable/foo | bar | Running | beef |
    And I am using the "Runnable" organization

  Scenario: Getting the logs of a running container specifiying the repo and branch
    Given the container named "bar-foo" has run logs:
      """
      This is some sample log data.
      """
    When I run `runnable log foo/bar` interactively
    And I wait 2 seconds
    And I send Ctrl+C
    Then the output should contain:
      """
      [Control + C to EXIT]
      """
    And the output should contain:
      """
      This is some sample log data.
      """

  Scenario: Getting the logs of a running container for current repo and branch
    Given I am in the "Runnable/foo" git repository
    And I am on branch "bar"
    And the container named "bar-foo" has run logs:
      """
      This is sample socket data.
      """
    When I run `runnable log` interactively
    And I wait 2 seconds
    And I send Ctrl+C
    Then the output should contain:
      """
      This is sample socket data.
      """

  Scenario: Getting the logs of a built container for current repo and branch
    Given I am in the "Runnable/foo" git repository
    And the container named "foo" has build logs:
      """
      Building your container.
      """
    When I run `runnable log --build`
    And I wait 2 seconds
    Then the output should contain:
      """
      Building your container.
      """
