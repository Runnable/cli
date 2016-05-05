Feature: Login into Runnable
  Background:
    Given I am part of the "Runnable" organization
    And I am part of the "Runnabear" organization

  Scenario: Basic login to Runnable
    When I run `runnable login` interactively
    And I type "bkendall"
    And I type "foobar"
    And I type "1"
    And I finished my input
    And I wait 1 second
    Then the output should contain "GitHub username:"
    And the output should contain "GitHub password:"
    And the output should contain "Authenticated"
    And the output should contain:
      """
      Choose a GitHub organization to use with Runnable [1-2]

        1) Runnabear
        2) Runnable

      >
      """
    And the output should contain "Selected organization:"
    And the exit status should be 0
    And I should be using the "Runnabear" organization
    And there should be a token generated for "bkendall"

  Scenario: Login to Runnable using two-factor authentication
    Given I require a two-factor code "123456"
    When I run `runnable login` interactively
    And I type "bkendall"
    And I type "foobar"
    And I type "123456"
    And I type "2"
    And I finished my input
    And I wait 1 second
    Then the output should contain "GitHub username:"
    And the output should contain "GitHub password:"
    And the output should contain "Two-factor code:"
    And the output should contain "Authenticated"
    And the output should contain "Choose a GitHub organization"
    And the output should contain "Selected organization:"
    And the exit status should be 0
    And I should be using the "Runnable" organization
    And there should be a token generated for "bkendall"

  Scenario: Login using a token
    When I run `runnable login -t mytoken` interactively
    And I type "2"
    And I finished my input
    And I wait 1 second
    Then the output should not contain "GitHub username:"
    And the output should not contain "GitHub password:"
    And the output should contain "Choose a GitHub organization"
    And the output should contain "Selected organization:"
    And the exit status should be 0
    And I should be using the "Runnable" organization
