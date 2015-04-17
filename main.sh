#!/bin/bash

# Configuration
# ---------------------------------------------------------------------

# The instructor's course repository
# A good template to use for course repository names is:
#   SUBJECT-NUMBER-YEAR-SEMESTER  (NO SPACES)
readonly REPO=starterupper

# Your school email address domain
readonly SCHOOL=wit.edu

# The instructor's Bitbucket username
readonly INSTRUCTOR_BITBUCKET=lawrancej

# The instructor's Github username
readonly INSTRUCTOR_GITHUB=lawrancej

# The instructor's Gitlab username
readonly INSTRUCTOR_GITLAB=lawrancej

# Upstream host: where to host the course repository
#   (uncomment only one upstream host)
readonly UPSTREAM_HOST=github.com
#readonly UPSTREAM=gitlab.com
#readonly UPSTREAM=bitbucket.org

# Upstream user (most likely the instructor's user name on the upstream host)
readonly UPSTREAM_USER=lawrancej

# Run starter upper
# ---------------------------------------------------------------------

# Go home
cd ~

# Download starter upper
curl -L https://github.com/lawrancej/starterupper/archive/master.zip 2> /dev/null > starterupper.zip
# Extract
unzip starterupper.zip 2>&1 > /dev/null
# Hide
mv starterupper-master .starterupper 2>&1 > /dev/null

# Fetch script, html and javascript
cp .starterupper/index.html "$REPO-index.html"
cp .starterupper/*.js .
cp .starterupper/starter-upper.sh .

# Run starter upper
chmod +x starter-upper.sh
. starter-upper.sh
starterupper::main

# Clean up
rm starterupper.zip
rm -rf .starterupper
rm starter-upper.sh
