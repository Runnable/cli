Feature: Help

  Scenario: Display Runnable CLI Help
    When I run `runnable --help`
    Then the output should contain:
    """
    Usage: runnable [options] <command>
    """
    And the exit status should be 0
