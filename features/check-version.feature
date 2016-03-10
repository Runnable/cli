Feature: Check CLI Version

  Scenario: I am up to date with the latest version
    Given the latest version is the same as mine
    When I run `runnable check-version`
    Then the output should contain "Current version"
    Then the output should contain "Remote version (latest)"
    Then the output should contain "You are up to date!"

  Scenario: I am behind the remote version
    Given the latest version is newer than mine
    When I run `runnable check-version`
    Then the output should contain "Current version"
    Then the output should contain "Remote version (latest): 1"
    Then the output should contain "You are out of date!"
