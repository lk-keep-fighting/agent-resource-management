#!/bin/bash
set -e

BRANCH=${1:-master}

echo "Pushing to GitLab..."
git push origin $BRANCH

echo "Pushing to GitHub..."
git push github $BRANCH

echo "Done!"
