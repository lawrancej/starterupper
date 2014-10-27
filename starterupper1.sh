#!/bin/bash
# Starter Upper: Setup git hosting for classroom use with minimal user interaction.

# Configuration
# ---------------------------------------------------------------------

# The repository to clone as upstream (NO SPACES)
readonly REPO=starterupper
# Default domain for school email
readonly SCHOOL=wit.edu
# The instructor's Github username
readonly INSTRUCTOR_GITHUB=lawrancej

# Issues:
# Make all functions idempotent
# start / open a bookmarklet?
# go through all pages when fetching usernames
# grading interface: checkout stuff rapid fire like, possibly use git notes (or just use the issue tracker)
# fall back to https remotes if the school doesn't support SSH
# if the public key already exists on another account, ask user if they'd like to wipe existing keypair and generate a new one.
# revoke authorization automatically DELETE /authorizations/:id  (need to store the id in the first place)
# bitbucket, gitlab support
# make it work for team projects
# make it work if the instructor repository is private (one way to achieve this would be to create the student private repo first)

# Runtime flags (DO NOT CHANGE)
# ---------------------------------------------------------------------
readonly PROGNAME=$(basename $0)
readonly ARGS="$@"

# Download a script and source it
Import() {
    local url="$1"
    local file="$(printf "$url" | sed "s/.*\/\(.*\)$/\1/")"
    curl -L "$url" > "$file"
    source "$file"
}

source utility.sh
source cli1.sh
source gravatar.sh
source github.sh

Github_setup() {
    User_setup
    echo $(User_getSchool)
    Github_setUsername
    Git_configureRepository "github.com" "$(Host_getUsername "github")" "$INSTRUCTOR_GITHUB"
    Github_authenticate
    Github_setFullName
    Github_createPrivateRepo
    Github_addCollaborator $INSTRUCTOR_GITHUB
    Github_sharePublicKey
    Git_pushRepo
    if [[ $(Utility_lastSuccess) ]]; then
        Git_showRepositories
        echo "Done"
    else
        echo -e "\e[1;37;41mERROR\e[0m: Unable to push."
        echo "Failed."
    fi
}

if [ $# == 0 ]; then
    Github_setup
elif [[ $1 == "clean" ]]; then
    Github_clean
elif [[ $1 == "collaborators" ]]; then
    Github_addCollaborators
fi
