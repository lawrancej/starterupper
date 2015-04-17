#!/bin/bash

# Configuration
# ---------------------------------------------------------------------

# The repository to clone as upstream (NO SPACES)
readonly REPO=starterupper
# Default domain for school email
readonly SCHOOL=wit.edu
# The instructor's Bitbucket username
readonly INSTRUCTOR_BITBUCKET=lawrancej
# The instructor's Github username
readonly INSTRUCTOR_GITHUB=lawrancej
# The instructor's Gitlab username
readonly INSTRUCTOR_GITLAB=lawrancej
# Upstream host (uncomment only one upstream host)
readonly UPSTREAM_HOST=github.com
#readonly UPSTREAM=gitlab.com
#readonly UPSTREAM=bitbucket.org
# Upstream instructor
readonly UPSTREAM_INSTRUCTOR=lawrancej

# Run starter upper
# ---------------------------------------------------------------------

cd ~

# Fetch script, html and javascript
# curl https://raw.githubusercontent.com/lawrancej/starterupper/gh-pages/starter-upper.sh 2> /dev/null > starter-upper.sh
# curl http://lawrancej.github.io/starterupper/index.html 2> /dev/null > $REPO-index.html
cp ~/projects/starterupper/index.html "$REPO-index.html"
cp ~/projects/starterupper/*.js .
cp ~/projects/starterupper/starter-upper.sh .

chmod +x starter-upper.sh
. starter-upper.sh
starterupper::main
