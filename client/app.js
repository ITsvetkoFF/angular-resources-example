angular.module('app', ['ngResource', 'ui.router', 'mgcrea.ngStrap'])
    // .run(function (gitHubResources) {
    //     gitHubResources.getToken();
    // })
    .controller('HomeCtrl', HomeCtrl)
    .controller('DetailsCtrl', DetailsCtrl)
    .factory('gitHubResources', gitHubResources)
    .factory('httpInterceptor', function ($rootScope, $q) {

        var requestsData = {};
        requestsData.active = 0;
        $rootScope.requestsData = requestsData;

        return {
            request: function (request) {
                requestsData.active++;
                return request;
            },
            response: function (response) {
                requestsData.active--;
                return response;
            },
            responseError: function (response) {
                requestsData.active--;
                return $q.reject(response);
            }
        };
    })
    .config(function ($stateProvider, $urlRouterProvider) {
            $urlRouterProvider.otherwise('/');
            $stateProvider
                .state("home", {
                    url: "/",
                    templateUrl: 'partials/home.html',
                    controller: 'HomeCtrl',
                    resolve: {
                        token: ['gitHubResources',
                            function (gitHubResources) {
                                return gitHubResources.getToken();
                            }]
                    }
                })
                .state("home.details", {
                    url: "details/:owner/:repo",
                    templateUrl: 'partials/details.html',
                    controller: 'DetailsCtrl'
                })
        }
    )
    .config(function ($httpProvider) {
        $httpProvider.interceptors.push('httpInterceptor');
    });

function HomeCtrl(gitHubResources, $scope, $http, $state) {
    $scope.user = gitHubResources.user().get(function (user) {
        $http.get(user.repos_url).then(function (repos) {
            $scope.repos = repos.data
        });
    });
    $scope.changeHireStatus = function () {
        $scope.user.hireable = !$scope.user.hireable;
        $scope.user.$update();
    };
    // $scope.repoDetails = function (owner, repo) {
    //     $state.go("home.details", {owner: owner, repo: repo});
    // };
}

function DetailsCtrl(gitHubResources, $scope, $stateParams) {
    var repo = $stateParams.repo;
    var owner = $stateParams.owner;
    $scope.repo = repo;
    $scope.issues = gitHubResources.issues(owner, repo).query(function () {
        $scope.issues.forEach(function (issue) {
            issue.oldTitle = issue.title; //string will be copied by value
            issue.oldLabels = angular.copy(issue.labels);
        });
    });
    $scope.labels = gitHubResources.labels(owner, repo).query();
    $scope.updating = 0;
    $scope.updated = 0;
    var promises = [];
    $scope.updateLabels = function () {
        $scope.issues.forEach(function (issue) {
            if ((issue.oldTitle !== issue.title) || !angular.equals(issue.oldLabels, issue.labels)) {
                $scope.updating++;
                $scope.updated++;
                issue.$update(function () {
                    issue.oldLabels = angular.copy(issue.labels);
                    issue.oldTitle = issue.title;
                    $scope.updated--;
                    if ($scope.updated == 0) {
                        $scope.updating = 0;
                    }
                })
            }
        });
    }

}

function gitHubResources($http, $resource) {
    var gitHubToken;
    return {
        getToken: getToken,
        user: user,
        issues: issues,
        labels: labels
    };

    function getToken() {
        return $http.get('http://localhost:3000/api/github/token')
            .then(function (res) {
                gitHubToken = res.data.profiles[0].credentials.accessToken;
            });
    }

    function user() {
        return $resource('https://api.github.com/user', {access_token: gitHubToken}, {
            update: {
                method: 'PATCH',
                transformRequest: dropUnchangedUserFields
            }
        });
        function dropUnchangedUserFields(data) {
            return angular.toJson({
                hireable: data.hireable
            });
        }
    }

    function labels(owner, repo) {
        return $resource('https://api.github.com/repos/:owner/:repo/labels/', {
            owner: owner,
            repo: repo,
            access_token: gitHubToken
        });
    }

    function issues(owner, repo) {
        return $resource('https://api.github.com/repos/:owner/:repo/issues/:issueId', {
            owner: owner,
            repo: repo,
            access_token: gitHubToken
        }, {
            update: {
                method: 'PATCH',
                params: {issueId: '@number'},
                transformRequest: dropUnchangedIssueFields
            }
        });
        function dropUnchangedIssueFields(data) {
            return angular.toJson({
                labels: data.labels.map(function (label) {
                    return label.name
                }),
                title: data.title
            });
        }
    }

}
