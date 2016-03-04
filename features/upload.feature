Feature: Upload
  Background:
    Given the containers:
      | name | repo | branch | status | shortHash |
      | foo | Runnable/foo | master | Running | dead |
      | bar-foo | Runnable/foo | bar | Running | beef |
    And I am using the "Runnable" organization

  Scenario: Upload a single file from a local repository to a container
    Given I am in the "Runnable/foo" git repository
    And I am on branch "bar"
    And I have a local file named "test.txt" containing:
      """
      some sample data
      """
    When I run `runnable upload test.txt`
    And I wait 1 second
    Then the output should contain:
      """
      Uploaded file.
      """
    And the exit status should be 0
    And the file "test.txt" should have been uploaded to "/working-dir"

  Scenario: Upload a single file to the specified relative path
    Given I am in the "Runnable/foo" git repository
    And I am on branch "bar"
    And I have a local file named "test.txt" containing:
      """
      some sample data
      """
    When I run `runnable upload test.txt var/foo`
    And I wait 1 second
    Then the output should contain:
      """
      Uploaded file.
      """
    And the exit status should be 0
    And the file "test.txt" should have been uploaded to "/working-dir/var/foo"

  Scenario: Upload a single file to the specified absolute path
    Given I am in the "Runnable/foo" git repository
    And I am on branch "bar"
    And I have a local file named "test.txt" containing:
      """
      some sample data
      """
    When I run `runnable upload test.txt /var/foo`
    And I wait 1 second
    Then the output should contain:
      """
      Uploaded file.
      """
    And the exit status should be 0
    And the file "test.txt" should have been uploaded to "/var/foo"
