Feature: Organization Selection
  Background:
    Given I am part of the "Runnable" organization
    And I am part of the "Runnabear" organization
    And I am using the "Runnable" organization

  Scenario: Change Organization by Number
    When I run `runnable org` interactively
    And I type "1"
    And I finished my input
    Then the output should contain:
      """
      Choose a GitHub organization to use with Runnable [1-2]

        1) Runnabear
        2) Runnable

      >
      """
    And the output should contain:
      """
      Selected organization: Runnabear
      """
    And the exit status should be 0
    And I should be using the "Runnabear" organization

  Scenario: Change Organization by Name
    When I run `runnable org` interactively
    And I type "Runnabear"
    And I finished my input
    Then the output should contain:
      """
      Choose a GitHub organization to use with Runnable [1-2]

        1) Runnabear
        2) Runnable

      >
      """
    And the output should contain:
      """
      Selected organization: Runnabear
      """
    And the exit status should be 0
    And I should be using the "Runnabear" organization

  Scenario: Choosing an Invalid Organization
    When I run `runnable org` interactively
    And I type "foobar"
    And I finished my input
    Then the output should contain "Could not parse your selection"
    And I should be using the "Runnable" organization
