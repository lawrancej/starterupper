#!/bin/bash

# Run starterupper locally (use for testing, not deployment)
# Configuration
# ---------------------------------------------------------------------

# The course repository, aka upstream, is at:
# https://UPSTREAM_HOST/UPSTREAM_USER/REPO

# The course repository project host (Pick only one below)
readonly UPSTREAM_HOST=github.com
#readonly UPSTREAM_HOST=gitlab.com
#readonly UPSTREAM_HOST=bitbucket.org

# The course repository username (i.e., the instructor username)
readonly UPSTREAM_USER=lawrancej

# The instructor's user name at each project host
# (comment out if you have no account on that host)
readonly INSTRUCTOR_BITBUCKET=lawrancej
readonly INSTRUCTOR_GITHUB=lawrancej
readonly INSTRUCTOR_GITLAB=lawrancej

# The course repository name
# Hint: subject-number-year-semester (NO SPACES ALLOWED)
readonly REPO=starterupper

# The domain of your school
# (Used to guess student school email addresses)
readonly SCHOOL=wit.edu

# Run starter upper locally: ./local-main.sh
# ---------------------------------------------------------------------

# Move starterupper from the current folder into hidden folder
mkdir -p ~/.starterupper
cp * ~/.starterupper > /dev/null 2>&1
# Wherever we are, go home
cd ~
# Make starter upper executable
chmod +x .starterupper/starter-upper.sh
# Import starter upper
. .starterupper/starter-upper.sh
# Run
starterupper::main
