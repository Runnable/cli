Feature: SSH to Container
  Background:
    Given the containers:
      | name | repo | branch | status | shortHash |
      | foo | Runnable/foo | master | Running | dead |
      | bar-foo | Runnable/foo | bar | Running | beef |
    And I am using the "Runnable" organization

  Scenario: SSH to specified container
    Given the container named "foo" has terminal logs:
      """
      some
      sample
      terminal
      data
      """
    When I run `runnable ssh foo/master` interactively
    And I wait 1 second
    And I type "echo hi"
    And I finished my input
    Then the output should contain:
      """
      some
      sample
      terminal
      data
      """
    And the exit status should be 0

  Scenario: SSH to the container for the current repository
    Given I am in the "Runnable/foo" git repository
    And I am on branch "bar"
    And the container named "bar-foo" has terminal logs:
      """
      red leather
      yellow leather
      """
    When I run `runnable ssh` interactively
    And I wait 1 second
    And I type "echo hi"
    And I finished my input
    Then the output should contain:
      """
      red leather
      yellow leather
      """
    And the exit status should be 0
