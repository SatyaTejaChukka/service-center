import os
import tempfile
import pytest

# Ensure all tests run in an isolated temporary directory and never touch production/local SQLite DB
TEST_DIR = tempfile.mkdtemp(prefix="pr_test_data_")
os.environ["PR_DATA_DIR"] = TEST_DIR
