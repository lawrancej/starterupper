#!/bin/bash

readonly REPOSITORY="$REPO"

# Utilities
# ---------------------------------------------------------------------

# "return" failure
utility::fail() {
    echo -n
    return 1
}

# "return" success
utility::success() {
    printf true
    return 0
}

# Cross-platform paste to clipboard
utility::paste() {
    case $OSTYPE in
        msys | cygwin ) echo "$1" > /dev/clipboard ;;
        linux* | bsd* ) echo "$1" | xclip -selection clipboard ;;
        darwin* ) echo "$1" | pbcopy ;;
        *) return 1 ;;
    esac
}

# Cross-platform file open
utility::fileOpen() {
    case $OSTYPE in
        msys | cygwin ) start "$1" ;;
        linux* | bsd* ) xdg-open "$1" ;;
        darwin* ) open "$1" ;;
        *) return 1 ;;
    esac
}

# Validate nonempty value matches a regex
# Return success if the value is not empty and matches regex, fail otherwise
utility::nonEmptyValueMatchesRegex() {
    local value="$1"; shift
    local regex="$1"
    
    # First, check if value is empty
    if [[ -z "$value" ]]; then
        utility::fail
    # Then, check whether value matches regex
    elif [[ -z "$(echo "$value" | grep -E "$regex" )" ]]; then
        utility::fail
    else
        utility::success
    fi
}

# SSH
# ---------------------------------------------------------------------

# Configure SSH public/private keypair
ssh::keypair() {
    # If our public/private keypair doesn't exist, make it.
    if ! [[ -f ~/.ssh/id_rsa.pub ]]; then
        # Use default location, set no phassphrase, no questions asked
        printf "\n" | ssh-keygen -t rsa -N '' > /dev/null 2>&1
    fi
}

# Add hosts to known hosts file
ssh::add_hosts() {
    for host in "$@"; do
        if ! grep -q "^$host" ~/.ssh/known_hosts; then
            ssh-keyscan -t rsa "$host" 2> /dev/null >> ~/.ssh/known_hosts
        fi
    done
}

# Configure SSH to use port 443 where available to bypass restrictive firewalls
ssh::bypass_firewall() {
    if ! grep -q "github.com" ~/.ssh/config; then
        printf "Host github.com\n  Hostname ssh.github.com\n  Port 443\n" >> ~/.ssh/config
    fi
    if ! grep -q "bitbucket.org" ~/.ssh/config; then
        printf "Host bitbucket.org\n  Hostname altssh.bitbucket.org\n  Port 443\n" >> ~/.ssh/config
    fi
}

# Configure SSH and add known hosts keys
ssh::configure() {
    # Just in case they've never used SSH before...
    mkdir -p ~/.ssh
    touch ~/.ssh/known_hosts
    touch ~/.ssh/config
    
    ssh::keypair
    
    ssh::add_hosts bitbucket.org github.com gitlab.com ssh.github.com \
    altssh.bitbucket.org
    
    ssh::bypass_firewall
    
    # Sanity check
    [[ -f ~/.ssh/id_rsa.pub ]] && [[ -f ~/.ssh/known_hosts ]]
    return $?
}

# Get the user's public key, ignoring the trailing comment
ssh::getPublicKey() {
    sed -e 's/==.*$/==/' ~/.ssh/id_rsa.pub
}

# Make slashes suitable for sed
ssh::getPublicKeyForSed() {
    ssh::getPublicKey | sed -e 's/[/]/\\\//g'
}

# User functions
# ---------------------------------------------------------------------

# Get the user's username
username::get() {
    local username="$USERNAME"
    if [[ -z "$username" ]]; then
        username="$(id -nu 2> /dev/null)"
    fi
    if [[ -z "$username" ]]; then
        username="$(whoami 2> /dev/null)"
    fi
    printf "%s" "$username"
}

# A full name needs a first and last name
full_name::valid() {
    local fullName="$1"
    utility::nonEmptyValueMatchesRegex "$fullName" "\w+ \w+"
}

# Set the full name
full_name::set() {
    local fullName="$1"
    if [[ $(full_name::valid "$fullName") ]]; then
        git config --global user.name "$fullName" > /dev/null
    fi
}

# Get the user's full name (Firstname Lastname); defaults to OS-supplied full name
# Side effect: set ~/.gitconfig user.name if unset and full name from OS validates.
full_name::get() {
    # First, look in the git configuration
    local fullName
    fullName="$(git config --global user.name)"
    
    # Ask the OS for the user's full name, if it's not valid
    if [[ ! $(full_name::valid "$fullName") ]]; then
        local username
        username="$(username::get)"
        case $OSTYPE in
            msys | cygwin )
                cat << 'EOF' > getfullname.ps1
$MethodDefinition = @'
[DllImport("secur32.dll", CharSet=CharSet.Auto, SetLastError=true)]
public static extern int GetUserNameEx (int nameFormat, System.Text.StringBuilder userName, ref uint userNameSize);
'@
$windows = Add-Type -MemberDefinition $MethodDefinition -Name 'Secur32' -Namespace 'Win32' -PassThru
$sb = New-Object System.Text.StringBuilder
$num=[uint32]256
$windows::GetUserNameEx(3, $sb, [ref]$num) | out-null
$sb.ToString()
EOF
                fullName="$(powershell -executionpolicy remotesigned -File getfullname.ps1 | sed -e 's/\(.*\), \(.*\)/\2 \1/')"
                if [[ "$fullName" == "The argument 'getfullname.ps1' to the -File parameter does not exist. Provide the path to an existing '.ps1' file as an argument to the -File parameter." ]]; then
                    fullName=""
                fi
                rm getfullname.ps1 > /dev/null
                ;;
            linux* )
                fullName="$(getent passwd "$username" | cut -d ':' -f 5 | cut -d ',' -f 1)"
                ;;
            darwin* )
                fullName="$(dscl . read "/Users/$(whoami)" RealName | grep -v RealName | cut -c 2-)"
                ;;
            *) fullName="" ;;
        esac
        
        # If we got a legit full name from the OS, update the git configuration to reflect it.
        full_name::set "$fullName"
    fi
    printf "%s" "$fullName"
}

# We're assuming that students have a .edu email address
email::valid() {
    local email
    email="$(printf "%s" "$1" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
    utility::nonEmptyValueMatchesRegex "$email" "edu$"
}

# Get the user's email; defaults to username@school
# Side effect: set ~/.gitconfig user.email if unset
email::get() {
    # Try to see if the user already stored the email address
    local email
    email="$(git config --global user.email | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
    # If the stored email is bogus, ...
    if [[ ! $(email::valid "$email") ]]; then
        # Guess an email address and save it
        email="$(username::get)@$SCHOOL"
    fi
    # Resave, just in case of goofups
    git config --global user.email "$email"
    printf "%s" "$email"
}

# Git
# ---------------------------------------------------------------------
cloned=false

# Clone/fetch upstream
git::clone_upstream() {
    local upstream="https://${UPSTREAM_HOST}/${UPSTREAM_USER}/$REPOSITORY.git"
    if [[ ! -d "$REPOSITORY" ]]; then
        git clone "$upstream" > /dev/null 2>&1
        pushd "$REPOSITORY" > /dev/null
        git remote rm origin 2> /dev/null
        git remote add upstream "$upstream"        
        popd > /dev/null
        
        if [[ $? -eq 0 ]]; then
            cloned=true
        fi
    fi
    
    pushd "$REPOSITORY" > /dev/null
    git submodule update --init --recursive > /dev/null
    git fetch --all > /dev/null 2>&1
    if [[ $? -eq 0 ]]; then
        cloned=true
    fi
    popd > /dev/null
    
    utility::fileOpen "$REPOSITORY"
}

# Make the index page
starterupper::make_ui() {
    sed -e "s/REPOSITORY/${REPOSITORY}/g" \
    -e "s/UPSTREAM_HOST/${UPSTREAM_HOST}/g" \
    -e "s/UPSTREAM_USER/${UPSTREAM_USER}/g" \
    -e "s/PUBLIC_KEY/$(ssh::getPublicKeyForSed)/g" \
    -e "s/USER_EMAIL/$(email::get)/g" \
    -e "s/FULL_NAME/$(full_name::get)/g" \
    -e "s/USER_NAME/$(username::get)/g" \
    -e "s/INSTRUCTOR_BITBUCKET/${INSTRUCTOR_BITBUCKET}/g" \
    -e "s/INSTRUCTOR_GITHUB/${INSTRUCTOR_GITHUB}/g" \
    -e "s/INSTRUCTOR_GITLAB/${INSTRUCTOR_GITLAB}/g" \
    -e "s/HOSTNAME/$(hostname)/g" \
    -e "s/CLONED/${cloned}/g" \
    ".starterupper/index.html" > ".starterupper/$REPOSITORY.html"
}

app::url() {
    printf "%s" "file://$(pwd | sed -e "s/^\\/c/\\/c:/")/.starterupper/$REPOSITORY.html"
}

starterupper::main() {
    # SSH key setup
    printf "Please wait, configuring SSH keys and known hosts..."
    ssh::configure
    if [[ $? -eq 0 ]]; then
        printf '                       [\x1B[1;32mOK\x1B[0m]\n'
    else
        printf '                                   [\x1B[1;31mFAILED\x1B[0m]\n'
        printf 'Type this in another terminal: \x1B[1;35mssh-keygen -t rsa -N ''\x1B[0m\n'
    fi
    
    # Clone upstream
    printf "Cloning upstream..."
    git::clone_upstream
    if [[ $cloned == true ]]; then
        printf '                                                        [\x1B[1;32mOK\x1B[0m]\n'
    else
        printf '                                                    [\x1B[1;31mFAILED\x1B[0m]\n'
    fi
    
    # Make web page
    printf "Generating user interface..."
    starterupper::make_ui
    printf '                                               [\x1B[1;32mOK\x1B[0m]\n'
    
    # Open setup page
    utility::paste "$(app::url)"
    echo "Opening: $(app::url)"
    utility::fileOpen ".starterupper/$REPOSITORY.html"
    printf 'with default browser, and copied URL above to the clipboard.               [\x1B[1;32mOK\x1B[0m]\n'
    printf '\nFollow the instructions carefully to complete setup.'
}
