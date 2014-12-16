#!/bin/bash

source utility.sh

# Github non-interactive functions
# ---------------------------------------------------------------------

# Set github login and print it back out
github::set_login() {
    local login="$1"
    if [[ $(github::validUsername "$login") ]]; then
        git config --global github.login "$login"
    fi
    git config --global github.login
}

# Helpers

# Invoke a Github API method requiring authorization using curl
github::invoke() {
    local method=$1; shift
    local url=$1; shift
    local data=$1;
    local header="Authorization: token $(git config --global github.token)"
    curl -i --request "$method" -H "$header" -d "$data" "https://api.github.com$url" 2> /dev/null
}

# Queries

# Is the name available on Github?
github::nameAvailable() {
    local username="$1"
    local result="$(curl -i https://api.github.com/users/$username 2> /dev/null)"
    if [[ -z $(echo $result | grep "HTTP/1.1 200 OK") ]]; then
        utility::success
    else
        utility::fail
    fi
}

# A valid Github username is not available, by definition
github::validUsername() {
    local username="$1"
    # If the name is legit, ...
    if [[ $(utility::nonEmptyValueMatchesRegex "$username" "^[0-9a-zA-Z][0-9a-zA-Z-]*$") ]]; then
        # And unavailable, ...
        if [[ ! $(github::nameAvailable $username) ]]; then
            # It's valid
            utility::success
        else
            utility::fail
        fi
    else
        # Otherwise, it's not valid
        utility::fail
    fi
}

# Are we logged into Github?
github::loggedIn() {
    if [[ -n "$(git config --global github.token)" ]]; then
        utility::success
    else
        utility::fail
    fi    
}

# Did the user add their email to the Github account?
github::emailAdded() {
    local email="$1"
    local emails="$(github::invoke GET "/user/emails" "" | tr '\n}[]{' ' \n   ')"
    if [[ -z $(echo "$emails" | grep "$email") ]]; then
        utility::fail
    else
        utility::success
    fi
}

# Did the user verify their email with Github?
github::emailVerified() {
    local email="$1"
    local emails="$(github::invoke GET "/user/emails" "" | tr '\n}[]{' ' \n   ')"
    if [[ -z $(echo "$emails" | grep "$email" | grep "verified...true") ]]; then
        utility::fail
    else
        utility::success
    fi
}

# What plan does the user have?
github::plan() {
    github::invoke GET /user '' \
        | sed -n -e '/[\"]plan[\"]/,${p}' \
        | grep -E "[\"]name[\"]" \
        | sed -e 's/ *[\"]name[\"]: [\"]\(.*\)[\"].*/\1/' \
        | tr 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' 'abcdefghijklmnopqrstuvwxyz'
}

# Is the user's plan upgraded?
github::upgradedPlan() {
    local plan="$(github::plan)"
    # If we got nothing back, we're not authenticated
    if [[ -z "$plan" ]]; then
        utility::fail
    # If we got something back, and it's not the free plan, we're good
    elif [[ "$plan" != "free" ]]; then
        utility::success
    # The free plan won't cut it
    else
        utility::fail
    fi
}

# start -> logged_in -> added email -> verified email -> upgraded account
github::accountStatus() {
    local email="$(user::getEmail)"
    if [[ ! $(github::loggedIn) ]]; then
        printf "start"
    elif [[ ! $(github::emailAdded "$email") ]]; then
        printf "logged_in"
    elif [[ ! $(github::emailVerified "$email") ]]; then
        printf "added_email"
    elif [[ ! $(github::upgradedPlan) ]]; then
        printf "verified_email"
    else
        printf "upgraded"
    fi
}

# Commands

# Log out of Github
github::logout() {
    git config --global --unset github.login
    git config --global --unset github.token
}

# Add email to Github account, if not already added
# Even though this adds email programmatically, Github will not send a verification email.
github::addEmail() {
    local email="$1"
    if [[ ! $(github::emailAdded "$email") ]]; then
        github::invoke POST "/user/emails" "[\"$email\"]" > /dev/null
    fi
}

# Github CLI-interactive functions
# ---------------------------------------------------------------------

github::hasAccount() {
    local hasAccount="n"
    # If we don't have their github login, ...
    if [[ -z "$(git config --global github.login)" ]]; then
        # Ask if they're on github yet
        read -p "Do you have a Github account (yes or No [default])? " hasAccount < /dev/tty
        # Let's assume that they don't by default
        if [[ $hasAccount != [Yy]* ]]; then
            utility::fail
        else
            utility::success
        fi
    else
        utility::success
    fi
}

# Ask the user if they have an account yet, and guide them through onboarding
github::join() {
    local hasAccount="n"
    
    # If we don't have their github login, ...
    if [[ -z "$(git config --global github.login)" ]]; then
        # Ask if they're on github yet
        read -p "Do you have a Github account (yes or No [default])? " hasAccount < /dev/tty

        echo -e "\e[1;37;41mIMPORTANT\e[0m: Before we proceed, you need to complete ALL of these steps:"

        # Let's assume that they don't by default
        if [[ $hasAccount != [Yy]* ]]; then
            echo "1. Join Github, using $(user::getEmail) as your email address."
            echo "2. Open your email inbox and verify your school email address."
            echo "3. Request an individual student educational discount."
            echo ""
            
            echo "Press enter to join Github."
            Interactive_fileOpen "https://github.com/join"
        else
            echo "1. Share and verify your school email address with Github."
            echo "2. Request an individual student educational discount."
            echo ""
        fi
        
        github::verifyEmail
        github::getDiscount

    fi
}

# Set the Github username, if not already set
github::setUsername() {
    github::join
    if [[ -z "$(git config --global github.token)" ]]; then
        Interactive_setValue "github.login" "$(Host_getUsername "github")" "github::validUsername" "Github username" "\nNOTE: Usernames are case-sensitive. See: https://github.com"
    fi
}

# Attempt to login to Github
github::authorize() {
    local password="$1"; shift
    local code="$1"
    read -r -d '' json <<-EOF
            {
                "scopes": ["repo", "public_repo", "user", "write:public_key", "user:email"],
                "note": "starterupper $(date --iso-8601=seconds)"
            }
EOF
    curl -i -u $(user::getEmail):$password -H "X-GitHub-OTP: $code" -d "$json" https://api.github.com/authorizations 2> /dev/null
}

# Idea: refactor to use interactive_setValue instead.
# Acquire authentication token and store in github.token
github::authenticate() {
    # Don't bother if we already got the authentication token
    if [[ -n "$(git config --global github.token)" ]]; then
        return 0
    fi
    local token="HTTP/1.1 401 Unauthorized"
    local code=''
    local password=''
    # As long as we're unauthorized, ...
    while [[ ! -z "$(echo $token | grep "HTTP/1.1 401 Unauthorized" )" ]]; do
        # Ask for a password
        if [[ -z "$password" ]]; then
            read -s -p "Enter Github password (not shown or saved): " password < /dev/tty
            echo # We need this, otherwise it'll look bad
        fi
        # Generate authentication token request
        token=$(github::authorize "$password" "$code")
        # If we got a bad credential, we need to reset the password and try again
        if [[ ! -z $(echo $token | grep "Bad credential") ]]; then
            echo -e "\e[1;37;41mERROR\e[0m: Incorrect password for user $(Host_getUsername "github"). Please wait."
            password=''
            sleep 1
        fi
        # If the user has two-factor authentication, ask for it.
        if [[ ! -z $(echo $token | grep "two-factor" ) ]]; then
            read -p "Enter Github two-factor authentication code: " code < /dev/tty
        fi
    done
    # By now, we're authenticated, ...
    if [[ ! -z $(echo $token | grep "HTTP/... 20." ) ]]; then
        # So, extract the token and store it in github.token
        token=$(echo $token | tr '"' '\n' | grep -E '[0-9a-f]{40}')
        git config --global github.token "$token"
        echo "Authenticated!"
    # Or something really bad happened, in which case, github.token will remain unset...
    else
        # When bad things happen, degrade gracefully.
        echo -n -e "\e[1;37;41mERROR\e[0m: "
        echo "$token" | grep "HTTP/..."
        echo
        echo "I encountered a problem and need your help to finish these setup steps:"
        echo
        echo "1. Update your Github profile to include your full name."
        echo "2. Create private repository $REPO on Github."
        echo "3. Add $INSTRUCTOR_GITHUB as a collaborator."
        echo "4. Share your public SSH key with Github."
        echo "5. Push to your private repository."
        echo
    fi
}

# Share full name with Github
github::setFullName() {
    local fullName="$(user::getFullName)"
    # If authentication failed, degrade gracefully
    if [[ -z $(git config --global github.token) ]]; then
        echo "Press enter to open https://github.com/settings/profile to update your Github profile."
        echo "On that page, enter your full name. $(Interactive_paste "$fullName" "your full name")"
        echo "Then, click Update profile."
        Interactive_fileOpen "https://github.com/settings/profile"
    # Otherwise, use the API
    else
        echo "Updating Github profile information..."
        github::invoke PATCH "/user" "{\"name\": \"$fullName\"}" > /dev/null
    fi
}

# Share the public key
github::sharePublicKey() {
    local githubLogin="$(Host_getUsername "github")"
    # If authentication failed, degrade gracefully
    if [[ -z "$(git config --global github.token)" ]]; then
        echo "Press enter to open https://github.com/settings/ssh to share your public SSH key with Github."
        echo "On that page, click Add SSH Key, then enter these details:"
        echo "Title: $(hostname)"
        echo "Key: $(Interactive_paste "$(ssh::getPublicKey)" "your public SSH key")"
        Interactive_fileOpen "https://github.com/settings/ssh"
    # Otherwise, use the API
    else
        # Check if public key is shared
        local publickeyShared=$(curl -i https://api.github.com/users/$githubLogin/keys 2> /dev/null)
        # If not shared, share it
        if [[ -z $(echo "$publickeyShared" | grep $(ssh::getPublicKey | sed -e 's/ssh-rsa \(.*\)=.*/\1/')) ]]; then
            echo "Sharing public key..."
            github::invoke POST "/user/keys" "{\"title\": \"$(hostname)\", \"key\": \"$(ssh::getPublicKey)\"}" > /dev/null
        fi
    fi
    # Test SSH connection on default port (22)
    if [[ ! $(ssh::connected "github.com") ]]; then
        echo "Your network has blocked port 22; trying port 443..."
        printf "Host github.com\n  Hostname ssh.github.com\n  Port 443\n" >> ~/.ssh/config
        # Test SSH connection on port 443
        if [[ ! $(ssh::connected "github.com") ]]; then
            echo "WARNING: Your network has blocked SSH."
            ssh_works=false
        fi
    fi
}

# Create a private repository on Github
github::createPrivateRepo() {
    # If authentication failed, degrade gracefully
    if [[ -z "$(git config --global github.token)" ]]; then
        github::manualCreatePrivateRepo
        return 0
    fi
    
    local githubLogin="$(Host_getUsername "github")"
    # Don't create a private repo if it already exists
    if [[ -z $(github::invoke GET "/repos/$githubLogin/$REPO" "" | grep "Not Found") ]]; then
        return 0
    fi
    
    echo "Creating private repository $githubLogin/$REPO on Github..."
    local result="$(github::invoke POST "/user/repos" "{\"name\": \"$REPO\", \"private\": true}")"
    if [[ ! -z $(echo $result | grep "HTTP/... 4.." ) ]]; then
        echo -n -e "\e[1;37;41mERROR\e[0m: "
        echo "Unable to create private repository."
        echo
        echo "Troubleshooting:"
        echo "* Make sure you have verified your school email address."
        echo "* Apply for the individual student educational discount if you haven't already done so."
        echo "* If you were already a Github user, free up some private repositories."
        echo
        
        github::verifyEmail
        github::getDiscount
        github::manualCreatePrivateRepo
    fi
}

# Add a collaborator
github::addCollaborator() {
    local githubLogin="$(Host_getUsername "github")"
    # If authentication failed, degrade gracefully
    if [[ -z "$(git config --global github.token)" ]]; then
        echo "Press enter to open https://github.com/$githubLogin/$REPO/settings/collaboration to add $1 as a collaborator."
        echo "$(Interactive_paste "$1" "$1")"
        echo "Click Add collaborator."
        Interactive_fileOpen "https://github.com/$githubLogin/$REPO/settings/collaboration"
    # Otherwise, use the API
    else
        echo "Adding $1 as a collaborator..."
        github::invoke PUT "/repos/$githubLogin/$REPO/collaborators/$1" "" > /dev/null
    fi
}

# Clean up everything but the repo (BEWARE!)
github::clean() {
    echo "Delete starterupper-script under Personal access tokens"
    Interactive_fileOpen "https://github.com/settings/applications"
    sed -i s/.*github.com.*// ~/.ssh/known_hosts
    git config --global --unset user.name
    git config --global --unset user.email
    git config --global --unset github.login
    git config --global --unset github.token
    rm -f ~/.ssh/id_rsa*
}

# Add collaborators
github::addCollaborators() {
    cd ~/$REPO
    for repository in $(github::invoke GET "/user/repos?type=member\&sort=created\&page=1\&per_page=100" "" | grep "full_name.*$REPO" | sed s/.*full_name....// | sed s/..$//); do
        git remote add ${repository%/*} git@github.com:$repository.git 2> /dev/null
    done
    git fetch --all
}

# Deprecate these

# Create a private repository manually
github::manualCreatePrivateRepo() {
    echo "Press enter to open https://github.com/new to create private repository $REPO on Github."
    echo "On that page, for Repository name, enter: $REPO. $(Interactive_paste "$REPO" "the repository name")"
    echo "Then, select Private and click Create Repository (DON'T tinker with other settings)."
    Interactive_fileOpen "https://github.com/new"
}

# Ask user to verify email
github::verifyEmail() {
    echo "Press enter to open https://github.com/settings/emails to add your school email address."
    echo "Open your email inbox and wait a minute for an email from Github."
    echo "Follow its instructions: click the link in the email and click Confirm."
    echo "$(Interactive_paste $(user::getEmail) "your school email")"
    Interactive_fileOpen "https://github.com/settings/emails"
}

# Ask the user to get the discount
github::getDiscount() {
    echo "Press enter to open https://education.github.com/discount_requests/new to request an individual student educational discount from Github."
    Interactive_fileOpen "https://education.github.com/discount_requests/new"
}

# github::plan

# Hmm, deep screen sandboxing mode will run a command twice. This is bad.
# Possible workaround: submit bogus password?
# github::authenticate
# github::addEmail "q2w3e4r5@mailinator.com"
# echo $(github::emailAdded "lawrancej@wit.edu")
# echo $(github::emailVerified "lawrancej@wit.edu")