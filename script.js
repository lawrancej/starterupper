// Workarounds for legacy browsers
// Courtesy: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
if ( !Date.prototype.toISOString ) {
  ( function() {
    function pad(number) {
      var r = String(number);
      if ( r.length === 1 ) {
        r = '0' + r;
      }
      return r;
    }
    Date.prototype.toISOString = function() {
      return this.getUTCFullYear()
        + '-' + pad( this.getUTCMonth() + 1 )
        + '-' + pad( this.getUTCDate() )
        + 'T' + pad( this.getUTCHours() )
        + ':' + pad( this.getUTCMinutes() )
        + ':' + pad( this.getUTCSeconds() )
        + '.' + String( (this.getUTCMilliseconds()/1000).toFixed(3) ).slice( 2, 5 )
        + 'Z';
    };
  }() );
}

// btoa (worry about this) IE10+ 
// see: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22

// Methods with an object parameter often require two callbacks in an object:
// success and fail.

// Repository and instructor names
var model = {
    // Remotes setup in the local repository
    remotes: $('#remote-names').val().split(' '),
    // Name of the repository
    repo: function()           { return $("#repository").val(); },
    // Upstream url
    upstream: function()       { return "https://" + $('#upstream-host').val() + "/" + $('#upstream-user').val() + "/" + model.repo(); },
    // Who's the instructor?
    instructor: function(host) { return $("#instructor-" + host).val(); },
    // Do we have this remote in the list?
    hasRemote: function(name) { return model.remotes.indexOf(name) >= 0; },
};

// Workaround for moronic web browsers (i.e., IE)
var localStorageWrapper = {
    data: {},
    setItem: function(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            localStorageWrapper.data[key] = value;
        }
    },
    getItem: function(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return localStorageWrapper.data[key];
        }
    },
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            delete localStorageWrapper.data[key];
        }
    },
    hasOwnProperty: function(key) {
        try {
            return localStorage.hasOwnProperty(key);
        } catch (e) {
            return localStorageWrapper.data.hasOwnProperty(key);
        }
    }
};

var controller = {
    // Show class and hide its opposite
    update: function(klass, value) {
        $(((value) ? "." : ".no-")+klass).show();
        $(((value) ? ".no-" : ".")+klass).hide();
        localStorageWrapper.setItem(klass, value);
    },
};

// User information
var user = {
  get: function(field) {
    if (user[field].isValid()) {
        localStorageWrapper.setItem("User." + field, user[field].value());
    }
    return localStorageWrapper.getItem("User." + field);
  },
  login: {
    value: function() { return $("#login").val(); },
    isValid: function() { return user.login.value() !== "USER_NAME" && user.login.value().length > 0; },
  },
  host: {
    value: function() { return $("#host").val(); },
    isValid: function() { return user.login.value().length > 0; },
  },
  key : {
    value: function() { return $("#public-key").val(); },
    isValid: function() { return /ssh-rsa .*/.test(user.key.value()); },
  },
  name : {
    value: function() { return $("#name").val().trim(); },
    isValid: function() { return /[^ ]+( [^ ]+)+/.test(user.name.value()); },
    changed: function() { return $("#stored-name").val() != user.name.value(); },
  },
  email : {
    isValid: function() { return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(user.email.value()) && /edu$/.test(user.email.value()); },
    value: function() { return $("#email").val().toLowerCase().trim(); },
    changed: function() { return $("#stored-email").val() != user.email.value(); },
  },
  gravatar : {
    value: function() {
        try {
            return SparkMD5.hash(user.get("email"));
        } catch (e) {
            return "";
        }
    },
    changed: function() { return user.gravatar.value() != localStorageWrapper.getItem("Gravatar"); },
    isValid: function() { return localStorageWrapper.hasOwnProperty("Gravatar"); },
    checkValid: function(callback) {
        if (user.gravatar.changed()) {
            $.ajax({
                method: "GET",
                dataType: "jsonp",
                crossDomain: true,
                processData: false,
                url: 'https://en.gravatar.com/' + user.gravatar.value() + '.json',
                success: function(response) {
                    localStorageWrapper.setItem("Gravatar", user.gravatar.value());
                    callback(true);
                },
                error: function(response) {
                    localStorageWrapper.removeItem("Gravatar");
                    callback(false);
                }
            });
        } else {
            callback(user.gravatar.isValid());
        }
    },
  },
};

// Bitbucket wrapper
var Bitbucket = {
    getUsername: function() { return $('#bitbucket-login').val(); },
    repoURL: function() { return "https://bitbucket.org/" + Bitbucket.getUsername() + "/" + model.repo(); },
    existingUser: function() { return Bitbucket.getUsername() != ""; },
    getHostname: function() { return "bitbucket.org"; }
}

// Github wrapper
var Github = {
    getHostname: function() { return "github.com"; },

    // Innocent until proven guilty properties
    badCredentials: false,
    setOTP: false,
    upgraded: false,
    emailVerified: false,
    nameShared: false,
    keyShared: false,
    repoCreated: false,
    
    // Use email to authenticate (because nobody remembers their username)
    email: "",
    // Self-explanatory
    password: "",
    // One Time Password for Two-factor authentication
    otp: "",
    
    // Collaborator set (a map of collaborators names to github.com)
    collaborators : {},
    
    // Are we signed in?
    authenticated: function () {
        return localStorageWrapper.hasOwnProperty("Github.token") && localStorageWrapper.hasOwnProperty("Github.username");
    },
    // Internal: used by API invoker
    getAuthorization: function () {
        if (localStorageWrapper.hasOwnProperty("Github.token")) {
            return "token " + localStorageWrapper.getItem("Github.token");
        } else {
            return "Basic " + btoa(Github.email + ":" + Github.password)
        }
    },
    // Return the Github user name
    getUsername: function() { return localStorageWrapper.getItem("Github.username"); },
    // Is the user already already a user?
    existingUser: function() { return localStorageWrapper.hasOwnProperty("Github.username"); },
    
    repoURL: function() { return "https://github.com/" + Github.getUsername() + "/" + model.repo(); },

    // Generic Github API invoker (used internally)
    invoke: function (settings) {
        var request = {
            crossDomain: true,
            url: "https://api.github.com" + settings.url,
            type: settings.method,
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Authorization", Github.getAuthorization());
                xhr.setRequestHeader("Content-Type", "application/json");
                if (Github.setOTP) {
                    xhr.setRequestHeader("X-Github-OTP", Github.otp);
                    // It is one time, after all
                    Github.setOTP=false;
                }
            },
            contentType: ("wwwForm" in settings) ? 'application/x-www-form-urlencoded; charset=UTF-8' : "application/json",
            dataType: "json",
            processData: ("wwwForm" in settings),
            success: settings.success,
            error: settings.fail
        }
        if (JSON.stringify(settings.data) !== "{}" && request.contentType === "application/json") {
            request.data = JSON.stringify(settings.data);
        } else if (request.contentType !== "application/json") {
            request.data = settings.data;
        }
        $.ajax(request);
    },

    // Login to Github given object with username, password, otp, and 
    // function callbacks: authenticated, badCredential, twoFactor
    login: function (settings) {
        // username could be the email or Github username
        Github.email = settings.username;
        Github.password = settings.password;
        Github.otp = settings.otp;
        var date = new Date();
        if (Github.authenticated()) {
            settings.authenticated();
        } else {
            Github.invoke({
                url: "/authorizations",
                method: "POST",
                data: {
                    scopes: ["repo","public_repo","user","write:public_key","user:email"],
                    note: "starterupper " + date.toISOString()
                },
                success: function (data) {
                    Github.badCredentials = false;
                    localStorageWrapper.setItem("Github.token", data.token);
                    Github.getUser({
                        success: function (response) {
                            localStorageWrapper.setItem("Github.username", response.login);
                            settings.authenticated();
                        }
                    });
                },
                fail: function (response) {
                    if (response.status == 401) {
                        // We should be looking at the response headers instead, probably: response.getResponseHeader('some_header')
                        if (response.responseJSON.message == "Bad credentials") {
                            Github.badCredentials = true;
                            settings.badCredential();
                        } else if (response.responseJSON.message == "Must specify two-factor authentication OTP code.") {
                            Github.setOTP = true;
                            settings.twoFactor();
                        }
                    }
                }
            });
        }
    },
    
    // Logout of Github
    logout: function() {
        localStorageWrapper.removeItem('Github.token');
    },
    
    // Get email configuration given object with fields: email, verified, fail
    // verified is function(bool)
    getEmail: function(settings) {
        Github.invoke({
            url: "/user/emails", method: "GET", data: {},
            success: function (response) {
                for (index in response) {
                    if (response[index].email == settings.email) {
                        settings.success(response[index].verified);
                        return;
                    }
                }
            },
        });
    },
    
    // Get user name given object with fields: success, fail
    getUser: function(settings) {
        Github.invoke({
            url: "/user", method: "GET", data: {},
            success: settings.success,
            fail: settings.fail
        });
    },
    
    // Set user name given object with fields: data, success, fail
    setUser: function(settings) {
        Github.invoke({
            url: "/user", method: "PATCH",
            data: settings.data,
            success: settings.success,
            fail: settings.fail
        });
    },
    
    // Share key given object with fields: key, title, success, fail
    shareKey: function(settings) {
        if (!user.key.isValid()) return;
        Github.invoke({
            url: "/user/keys", method: "GET", data: {},
            success: function(response) {
                for (index in response) {
                    if (response[index].key == settings.key) {
                        settings.success(response);
                        return;
                    }
                }
                // Send key
                Github.invoke({
                    url: "/user/keys", method: "POST",
                    data: {
                        title: settings.title,
                        key: settings.key
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            },
            fail: settings.fail
        });
    },

    // Perform all account setup steps given object with:
    // key: share the SSH key
    // title: the SSH key's title
    // name: share the user's full name
    // email: check it is verified
    // callback: function(key, boolean) to update view
    setupAccount: function(settings) {
        // Onboarding/authentication status
        settings.callback("github-onboard", !Github.existingUser());
        settings.callback('github-authenticated', Github.authenticated());
    
        if (Github.authenticated()) {
            // Nag the user if they're not on an upgraded plan
            if (!Github.upgraded) { 
                Github.getUser({
                    success: function(response) {
                        Github.upgraded = response.plan.name.toLowerCase() != "free";
                        settings.callback('github-upgraded', Github.upgraded);
                    }
                });
            }
            // Set their profile information
            if (!Github.nameShared) {
                Github.setUser({
                    data: { name: settings.name },
                    success: function(response) {
                        Github.nameShared = true;
                        settings.callback('github-profile',true);
                    },
                });
            }
            // Confirm email is verified
            if (!Github.emailVerified) {
                Github.getEmail({
                    email: settings.email,
                    success: function(response) {
                        Github.emailVerified = response;
                        settings.callback('github-email-verified',response);
                    }
                });
            }
            // Share key
            if (!Github.keyShared) {
                Github.shareKey({
                    title: settings.title,
                    key: settings.key,
                    success: function() {
                        Github.keyShared = true;
                        settings.callback('github-key',true);
                    },
                });
            }
            // Setup repository
            if (!Github.repoCreated) {
                Github.setupRepo(settings);
            }
        }
    },

    // Create repository given object with success and fail callbacks.
    createRepo: function(settings) {
        var url = "/repos/" + Github.getUsername() + "/" + model.repo();
        if (Github.authenticated()) {
            Github.invoke({
                method: "GET", url: url, data: {},
                // If the repo is created already, we're done
                success: settings.success,
                // Otherwise, we need to make it
                fail: function(response) {
                    Github.invoke({
                        method: "POST", url: "/user/repos",
                        data: { name: model.repo() },
                        success: settings.success,
                        fail: settings.fail,
                    });
                }
            });
        }
    },
    
    // Make repository private given object with success and fail callbacks
    privateRepo: function(settings) {
        var url = "/repos/" + Github.getUsername() + "/" + model.repo();
        Github.invoke({
            method: "PATCH", url: url,
            data: { name: model.repo(), "private": true },
            success: settings.success,
            fail: settings.fail
        });
    },

    // Add collaborator given object with a collaborator string and success, fail callbacks.
    addCollaborator: function(settings) {
        var url = "/repos/" + Github.getUsername() + "/" + model.repo() + "/collaborators/" + settings.collaborator;
        // If we have a collaborator already, great!
        Github.invoke({
            method: "GET", url: url, data: {},
            success: settings.success,
            // Otherwise, put the collaborator there
            fail: function() {
                Github.invoke({
                    method: "PUT", url: url, data: {},
                    success: settings.success,
                    fail: settings.fail
                });
            }
        });
    },
    
    // Populate collaborator set given object with a page integer and success, fail callbacks.
    getCollaborators: function(settings) {
        Github.invoke({
            method: "GET",
            url: "/user/repos",
            data: {
                "sort" : "created",
                "page" : settings.page,
                "per_page" : 100,
            },
            success: function(response) {
                for (var i = 0; i < response.length; i++) {
                    if (response[i].name == model.repo()) {
                        if (response[i].owner.login in Github.collaborators) {
                            return;
                        }
                        Github.collaborators[response[i].owner.login] = response[i].owner.login;
                        Github.invoke({
                            method: "GET", url: "/users/" + response[i].owner.login,
                            success: function(response) {
                                Github.collaborators[response.login] = response.name;
                                settings.callback(response.login, response.name);
                            },
                        });
                    }
                }
                if (response.length > 0) {
                    Github.getCollaborators({
                        page: settings.page + 1,
                        success: settings.success,
                        fail: settings.fail,
                    });
                } else {
                    settings.success(Github.collaborators);
                }
            },
            fail: settings.fail,
            wwwForm: true,
        });
    },

    // Create repository, add collaborator, and make private, given object with
    // callback function(key, bool) to update view
    setupRepo: function (settings) {
        Github.createRepo({
            success: function(response) {
                settings.callback('github-repository',true);
                Github.addCollaborator({
                    collaborator: model.instructor('github'),
                    success: function(response) {
                        settings.callback('github-collaborator', true);
                    },
                });
                // Make the repository private if we're not the instructor
                if (model.instructor('github') != Github.getUsername()) {
                    Github.privateRepo({
                        success: function(response) {
                            settings.callback('github-private', true);
                        },
                    });
                }
            },
        });
    }
};

// Gitlab wrapper
var Gitlab = {
    badCredentials: false,
    nameShared: false,
    emailVerified: false,
    keyShared: false,
    repoCreated: false,

    email: "",
    password: "",
    // Collaborator set (a map of collaborators names to github.com)
    collaborators : {},
    
    authenticated: function () {
        return localStorageWrapper.hasOwnProperty("Gitlab.token") && localStorageWrapper.hasOwnProperty("Gitlab.username");
    },
    getHostname: function() { return "gitlab.com"; },
    
    getAuthorization: function () {
        return localStorageWrapper.getItem("Gitlab.token");
    },
    
    getUsername: function() { return localStorageWrapper.getItem("Gitlab.username"); },
    existingUser: function() { return localStorageWrapper.hasOwnProperty("Gitlab.username"); },
    repoURL: function() { return "https://gitlab.com/" + Gitlab.getUsername() + "/" + model.repo().toLowerCase(); },

    // Generic Gitlab API invoker
    invoke: function (settings) {
        $.ajax({
            crossDomain: true,
            url: "https://gitlab.com/api/v3" + settings.url,
            type: settings.method,
            beforeSend: function(xhr) {
                xhr.setRequestHeader("PRIVATE-TOKEN", Gitlab.getAuthorization());
            },
            dataType: "json",
            data: settings.data,
            success: settings.success,
            error: settings.fail
        });
    },

    // Login to Gitlab
    login: function(settings) {
        Gitlab.email = settings.email;
        Gitlab.password = settings.password;
        if (Gitlab.authenticated()) {
            settings.authenticated();
        } else {
            $.ajax({
                crossDomain: true,
                url: "https://gitlab.com/api/v3/session",
                type: "POST",
                dataType: "json",
                data: { "email": Gitlab.email, "password": Gitlab.password },
                success: function(response) {
                    localStorageWrapper.setItem("Gitlab.username",response.username);
                    localStorageWrapper.setItem("Gitlab.token",response.private_token);
                    
                    settings.authenticated();
                },
                error: function(response) {
                    Gitlab.badCredentials = true;
                    settings.badCredential();
                }
            });
        }
    },
    
    logout: function() {
        localStorageWrapper.removeItem('Gitlab.token');
    },
    
    shareKey: function(settings) {
        if (!user.key.isValid()) return;
        Gitlab.invoke({
            url: "/user/keys",
            method: "GET",
            data: {},
            success: function(response) {
                settings.success(response);
                for (index in response) {
                    if (response[index].key == settings.key) {
                        settings.success(response);
                        return;
                    }
                }
                // Send key
                Gitlab.invoke({
                    url: "/user/keys",
                    method: "POST",
                    data: {
                        title: settings.title,
                        key: settings.key
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            },
            fail: settings.fail
        });
    },
    
    getUser: function(settings) {
        Gitlab.invoke({
            url: "/user",
            method: "GET",
            data: {},
            success: settings.success,
            fail: settings.fail
        });
    },
    
    // Find a user by name
    getUserByName: function(settings) {
        Gitlab.invoke({
            url: "/users?search="+settings.user,
            method: "GET",
            data: {},
            success: settings.success,
            fail: settings.fail
        });
    },

    setupAccount: function(settings) {
        // Onboarding/authentication status
        settings.callback("gitlab-onboard", !Gitlab.existingUser());
        settings.callback('gitlab-authenticated', Gitlab.authenticated());
        if (Gitlab.authenticated()) {
            // Nag the user if they didn't share their name or email
            if (!Gitlab.nameShared || !Gitlab.emailVerified) { 
                Gitlab.getUser({
                    success: function(response) {
                        Gitlab.nameShared = response.name == settings.name;
                        Gitlab.emailVerified = response.email == settings.email;
                        settings.callback('gitlab-profile', Gitlab.nameShared);
                        settings.callback('gitlab-email-verified', Gitlab.emailVerified);
                    }
                });
            }
            // Share key
            if (!Gitlab.keyShared) {
                Gitlab.shareKey({
                    title: settings.title,
                    key: settings.key,
                    success: function() {
                        Gitlab.keyShared = true;
                        settings.callback('gitlab-key',true);
                    },
                });
            }
            // Setup repo
            if (!Gitlab.repoCreated) {
                Gitlab.setupRepo(settings);
            }
        }
    },

    // Create repository
    createRepo: function(settings) {
        Gitlab.invoke({
            url: "/projects/" + Gitlab.getUsername() + "%2F" + model.repo().toLowerCase(),
            method: "GET",
            data: {},
            // If the repo is created already, we're done
            success: settings.success,
            // Otherwise, we need to make it
            fail: function(response) {
                Gitlab.invoke({
                    url: "/projects",
                    method: "POST",
                    data: {
                        name: model.repo(),
                        "public": false,
                        visibility_level: 0
                        // you could also set the import_url so something public
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            }
        });
    },

    // Populate collaborator set given object with a page integer and success, fail callbacks.
    getCollaborators: function(settings) {
        Gitlab.invoke({
            method: "GET",
            url: "/projects",
            data: {},
            success: function(response) {
                for (var i = 0; i < response.length; i++) {
                    if (response[i].path == model.repo().toLowerCase()) {
                        if (response[i].namespace.path in Gitlab.collaborators) {
                            return;
                        }
                        Gitlab.collaborators[response[i].namespace.path] = response[i].owner.name;
                    }
                }
                settings.success(Gitlab.collaborators);
            },
            fail: settings.fail,
        });
    },

    
    privateRepo: function(settings) {
        settings.success();
    },
    
    // Add collaborator
    addCollaborator: function(settings) {
        var url = "/projects/" + Gitlab.getUsername() + "%2F" + model.repo().toLowerCase() + "/members";
        Gitlab.getUserByName({
            user: settings.collaborator,
            success: function(response) {
                Gitlab.invoke({
                    method: "PUT",
                    "url": url,
                    data: {
                        "id": Gitlab.getUsername() + "%2F" + model.repo().toLowerCase(),
                        "user_id": response[0].id,
                        // See: https://gitlab.com/help/permissions/permissions
                        "access_level": 30 // Developer
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            },
            fail: settings.fail
        });
    },
    
    // Create repository, add collaborator, and make private, given object with
    // callback function(key, bool) to update view
    setupRepo: function (settings) {
        Gitlab.createRepo({
            success: function(response) {
                settings.callback('gitlab-repository',true);
                Gitlab.addCollaborator({
                    collaborator: model.instructor('gitlab'),
                    success: function(response) {
                        settings.callback('gitlab-collaborator', true);
                    },
                });
                // Make the repository private if we're not the instructor
                if (model.instructor('gitlab') != Gitlab.getUsername()) {
                    Gitlab.privateRepo({
                        success: function(response) {
                            settings.callback('gitlab-private', true);
                        },
                    });
                }
            },
        });
    }
};

var host = {
    // Get origin host (Prefer Github, then Gitlab, then Bitbucket)
    getOrigin: function() {
        var hosts = [ Github, Gitlab, Bitbucket ];
        
        for (var i = 0; i < hosts.length; i++) {
            if (hosts[i].existingUser()) {
                return hosts[i];
            }
        }
        return null;
    }
};
